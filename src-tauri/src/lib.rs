#[cfg(not(feature = "integrated-only"))]
use futures_util::StreamExt;
#[cfg(not(feature = "integrated-only"))]
use serde::Serialize;
use std::collections::HashMap;
#[cfg(not(feature = "integrated-only"))]
use std::fs::File;
#[cfg(not(feature = "integrated-only"))]
use std::io::Write;
use std::sync::{Arc, Mutex};
#[cfg(not(feature = "integrated-only"))]
use std::time::{Duration, Instant};
#[cfg(not(feature = "integrated-only"))]
use tauri::Emitter;
use tokio::sync::Notify;
mod integrated;
use tauri::Manager;

/// Tracks in-flight Ollama stream requests so the frontend can cancel one by
/// request ID (e.g. when the panel that started it unmounts). Keyed by the
/// same `request_id` the frontend generates per call.
#[derive(Default)]
struct CancelRegistry(Mutex<HashMap<String, Arc<Notify>>>);

#[cfg(not(feature = "integrated-only"))]
#[derive(Clone, Serialize)]
struct DownloadProgressPayload {
    downloaded: u64,
    total: Option<u64>,
}

#[cfg(not(feature = "integrated-only"))]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaStreamPayload {
    request_id: String,
    line: Option<String>,
    done: bool,
    error: Option<String>,
}

#[cfg(not(feature = "integrated-only"))]
async fn stream_ollama_lines(
    window: tauri::Window,
    cancel_notify: Arc<Notify>,
    event_name: &str,
    request_id: String,
    response: reqwest::Response,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    loop {
        // Race the next chunk against cancellation so an abandoned request
        // (e.g. its panel was closed) stops reading — and drops the
        // response, closing the connection to Ollama — even if it's still
        // waiting on the very first byte, not just between chunks.
        let next = tokio::select! {
            _ = cancel_notify.notified() => break,
            next = stream.next() => next,
        };

        let Some(next) = next else { break };
        let chunk = next.map_err(|err| format!("Ollama stream failed: {err}"))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        let mut lines = buffer.split('\n').map(|line| line.to_string()).collect::<Vec<_>>();
        buffer = lines.pop().unwrap_or_default();

        for raw in lines {
            let line = raw.trim();
            if line.is_empty() {
                continue;
            }
            window
                .emit(
                    event_name,
                    OllamaStreamPayload {
                        request_id: request_id.clone(),
                        line: Some(line.to_string()),
                        done: false,
                        error: None,
                    },
                )
                .map_err(|err| format!("Couldn't emit Ollama stream line: {err}"))?;
        }
    }

    let tail = buffer.trim();
    if !tail.is_empty() {
        window
            .emit(
                event_name,
                OllamaStreamPayload {
                    request_id: request_id.clone(),
                    line: Some(tail.to_string()),
                    done: false,
                    error: None,
                },
            )
            .map_err(|err| format!("Couldn't emit Ollama stream tail: {err}"))?;
    }

    window
        .emit(
            event_name,
            OllamaStreamPayload {
                request_id,
                line: None,
                done: true,
                error: None,
            },
        )
        .map_err(|err| format!("Couldn't emit Ollama stream completion: {err}"))?;

    Ok(())
}

fn register_cancel_notify(registry: &CancelRegistry, request_id: &str) -> Arc<Notify> {
    let notify = Arc::new(Notify::new());
    registry.0.lock().unwrap().insert(request_id.to_string(), notify.clone());
    notify
}

fn unregister_cancel_notify(registry: &CancelRegistry, request_id: &str) {
    registry.0.lock().unwrap().remove(request_id);
}

#[tauri::command]
fn cancel_ollama_stream(registry: tauri::State<'_, CancelRegistry>, request_id: String) {
    if let Some(notify) = registry.0.lock().unwrap().get(&request_id) {
        notify.notify_one();
    }
}

#[cfg(not(feature = "integrated-only"))]
fn response_error_message(status: reqwest::StatusCode, body: &str) -> String {
    if body.trim().is_empty() {
        format!("Ollama responded with an unexpected status ({status}).")
    } else {
        format!("Ollama responded with an unexpected status ({status}): {}", body.trim())
    }
}

#[cfg(not(feature = "integrated-only"))]
#[tauri::command]
async fn ollama_get_json(url: String) -> Result<String, String> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|err| format!("Couldn't reach Ollama: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(response_error_message(status, &body));
    }

    response
        .text()
        .await
        .map_err(|err| format!("Couldn't read Ollama response: {err}"))
}

#[cfg(not(feature = "integrated-only"))]
#[tauri::command]
async fn ollama_chat_stream(
    window: tauri::Window,
    cancel_registry: tauri::State<'_, CancelRegistry>,
    url: String,
    body_json: String,
    request_id: String,
) -> Result<(), String> {
    let body: serde_json::Value = serde_json::from_str(&body_json)
        .map_err(|err| format!("Invalid chat payload JSON: {err}"))?;

    let notify = register_cancel_notify(&cancel_registry, &request_id);

    let response = reqwest::Client::new()
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Couldn't reach Ollama: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        unregister_cancel_notify(&cancel_registry, &request_id);
        return Err(response_error_message(status, &body));
    }

    let result = stream_ollama_lines(window, notify, "ollama-chat-stream", request_id.clone(), response).await;
    unregister_cancel_notify(&cancel_registry, &request_id);
    result
}

#[cfg(not(feature = "integrated-only"))]
#[tauri::command]
async fn ollama_pull_stream(
    window: tauri::Window,
    cancel_registry: tauri::State<'_, CancelRegistry>,
    url: String,
    body_json: String,
    request_id: String,
) -> Result<(), String> {
    let body: serde_json::Value = serde_json::from_str(&body_json)
        .map_err(|err| format!("Invalid pull payload JSON: {err}"))?;

    let notify = register_cancel_notify(&cancel_registry, &request_id);

    let response = reqwest::Client::new()
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Couldn't reach Ollama: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        unregister_cancel_notify(&cancel_registry, &request_id);
        return Err(response_error_message(status, &body));
    }

    let result = stream_ollama_lines(window, notify, "ollama-pull-stream", request_id.clone(), response).await;
    unregister_cancel_notify(&cancel_registry, &request_id);
    result
}

#[cfg(not(feature = "integrated-only"))]
#[tauri::command]
async fn download_ollama_installer(
    window: tauri::Window,
    url: String,
    dest: String,
) -> Result<(), String> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|err| format!("Couldn't download Ollama installer: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Couldn't download Ollama installer (status {}).",
            response.status()
        ));
    }

    let total = response.content_length();
    let mut downloaded = 0_u64;
    window
        .emit("ollama-download-progress", DownloadProgressPayload { downloaded, total })
        .map_err(|err| format!("Couldn't emit installer progress: {err}"))?;

    let mut output_file =
        File::create(&dest).map_err(|err| format!("Couldn't create installer file: {err}"))?;
    let mut stream = response.bytes_stream();
    let mut last_emit_at = Instant::now();

    while let Some(next) = stream.next().await {
        let chunk = next.map_err(|err| format!("Installer download failed: {err}"))?;
        output_file
            .write_all(&chunk)
            .map_err(|err| format!("Couldn't write installer file: {err}"))?;
        downloaded += chunk.len() as u64;

        if last_emit_at.elapsed() >= Duration::from_millis(500) {
            window
                .emit("ollama-download-progress", DownloadProgressPayload { downloaded, total })
                .map_err(|err| format!("Couldn't emit installer progress: {err}"))?;
            last_emit_at = Instant::now();
        }
    }

    output_file
        .flush()
        .map_err(|err| format!("Couldn't finalize installer file: {err}"))?;
    window
        .emit("ollama-download-progress", DownloadProgressPayload { downloaded, total })
        .map_err(|err| format!("Couldn't emit installer progress: {err}"))?;

    Ok(())
}

#[cfg(not(feature = "integrated-only"))]
#[tauri::command]
fn launch_ollama_installer(path: String) -> Result<(), String> {
    std::process::Command::new(&path)
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("Couldn't launch Ollama installer: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(CancelRegistry::default())
        .manage(integrated::IntegratedRuntime::default())
        .invoke_handler(tauri::generate_handler![
            #[cfg(not(feature = "integrated-only"))]
            ollama_get_json,
            #[cfg(not(feature = "integrated-only"))]
            ollama_chat_stream,
            #[cfg(not(feature = "integrated-only"))]
            ollama_pull_stream,
            cancel_ollama_stream,
            #[cfg(not(feature = "integrated-only"))]
            download_ollama_installer,
            #[cfg(not(feature = "integrated-only"))]
            launch_ollama_installer,
            integrated::start_integrated_runtime,
            integrated::stop_integrated_runtime,
            integrated::integrated_chat_stream,
            integrated::integrated_runtime_model,
            integrated::integrated_setup_status,
            integrated::import_integrated_model,
            integrated::select_integrated_model,
            integrated::cancel_integrated_setup
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let _ = app.state::<integrated::IntegratedRuntime>().stop();
            }
        });
}
