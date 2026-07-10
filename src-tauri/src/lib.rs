use futures_util::StreamExt;
use serde::Serialize;
use std::fs::File;
use std::io::Write;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[derive(Clone, Serialize)]
struct DownloadProgressPayload {
    downloaded: u64,
    total: Option<u64>,
}

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
        .invoke_handler(tauri::generate_handler![
            download_ollama_installer,
            launch_ollama_installer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
