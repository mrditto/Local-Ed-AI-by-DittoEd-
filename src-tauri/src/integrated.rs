use sha2::{Digest, Sha256};
use std::io::Read;
use std::net::TcpListener;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(windows)]
mod job {
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use std::process::Child;
    use windows_sys::Win32::System::JobObjects::*;
    pub fn attach(child: &Child) -> Result<OwnedHandle, String> {
        unsafe {
            let raw = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if raw.is_null() {
                return Err("Couldn't create runtime process job.".into());
            }
            let handle = OwnedHandle::from_raw_handle(raw);
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                raw,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                std::mem::size_of_val(&limits) as u32,
            ) == 0
                || AssignProcessToJobObject(raw, child.as_raw_handle()) == 0
            {
                return Err("Couldn't protect runtime process cleanup.".into());
            }
            Ok(handle)
        }
    }
}

pub struct RuntimeProcess {
    child: Child,
    #[cfg(windows)]
    _job: std::os::windows::io::OwnedHandle,
    pub base_url: String,
    pub key: String,
    pub model_id: String,
    ready: bool,
}
impl Drop for RuntimeProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[derive(Default)]
pub struct IntegratedRuntime(
    pub Mutex<Option<RuntimeProcess>>,
    AtomicU64,
    tokio::sync::Mutex<()>,
);
impl IntegratedRuntime {
    pub fn stop(&self) -> Result<(), String> {
        self.1.fetch_add(1, Ordering::SeqCst);
        self.0
            .lock()
            .map_err(|_| "Runtime state unavailable.")?
            .take();
        Ok(())
    }
}

fn model_artifact(id: &str) -> Result<(&'static str, u64, &'static str), String> {
    match id {
        "qwen3.5-4b-q4-k-m" => Ok((
            "Qwen3.5-4B-Q4_K_M.gguf",
            2740937888,
            "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
        )),
        "qwen3.5-2b-q4-k-m" => Ok((
            "Qwen3.5-2B-Q4_K_M.gguf",
            1280835840,
            "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
        )),
        _ => Err("Unsupported integrated model.".into()),
    }
}
fn verify_model(path: &Path, size: u64, expected: &str) -> Result<(), String> {
    verify_model_cancel(path, size, expected, || false)
}
fn verify_model_cancel(
    path: &Path,
    size: u64,
    expected: &str,
    cancelled: impl Fn() -> bool,
) -> Result<(), String> {
    let mut file = std::fs::File::open(path).map_err(|_| "Download or import this model first.")?;
    if file
        .metadata()
        .map_err(|_| "Couldn't read model metadata.")?
        .len()
        != size
    {
        return Err("Model size does not match the verified artifact.".into());
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        if cancelled() {
            return Err("Model verification cancelled.".into());
        }
        let count = file
            .read(&mut buffer)
            .map_err(|_| "Couldn't verify model file.")?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err("Model checksum mismatch.".into());
    }
    Ok(())
}

fn launch(executable: &Path, model: &Path, id: &str) -> Result<RuntimeProcess, String> {
    if !executable.is_file() {
        return Err("Integrated runtime is not included in this build.".into());
    }
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|_| "Couldn't reserve a local runtime port.")?;
    let port = listener
        .local_addr()
        .map_err(|_| "Couldn't read local runtime port.")?
        .port();
    let mut random = [0u8; 32];
    getrandom::fill(&mut random).map_err(|_| "Couldn't secure the local runtime connection.")?;
    let key: String = random.iter().map(|byte| format!("{byte:02x}")).collect();
    let mut command = Command::new(executable);
    command
        .args(["-m"])
        .arg(model)
        .args([
            "--host",
            "127.0.0.1",
            "--port",
            &port.to_string(),
            "--api-key",
            &key,
            "--no-webui",
            "-ngl",
            "0",
            "-c",
            "4096",
            "-np",
            "1",
            "-t",
            "4",
            "--reasoning",
            "off",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    drop(listener);
    let mut child = command
        .spawn()
        .map_err(|_| "Couldn't start integrated runtime. Check its DLLs and Windows policy.")?;
    #[cfg(windows)]
    let job = match job::attach(&child) {
        Ok(job) => job,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
    };
    Ok(RuntimeProcess {
        child,
        #[cfg(windows)]
        _job: job,
        base_url: format!("http://127.0.0.1:{port}"),
        key,
        model_id: id.into(),
        ready: false,
    })
}

#[tauri::command]
pub async fn start_integrated_runtime(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<(), String> {
    let epoch = app.state::<IntegratedRuntime>().1.load(Ordering::SeqCst);
    let (filename, size, hash) = model_artifact(&model_id)?;
    let model = available_model_path(&app, filename, size)?;
    let executable = app
        .path()
        .resource_dir()
        .map_err(|_| "Couldn't locate runtime resources.")?
        .join("local-ai-runtime")
        .join("llama-server.exe");
    let verification_path = model.clone();
    let verification_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        verify_model_cancel(&verification_path, size, hash, || {
            verification_app
                .state::<IntegratedRuntime>()
                .1
                .load(Ordering::SeqCst)
                != epoch
        })
    })
    .await
    .map_err(|_| "Model verification failed.")??;
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(1))
        .build()
        .map_err(|_| "Couldn't create local runtime client.")?;
    let (base, key) = {
        let state = app.state::<IntegratedRuntime>();
        let mut process = state.0.lock().map_err(|_| "Runtime state unavailable.")?;
        if state.1.load(Ordering::SeqCst) != epoch {
            return Err("Runtime startup was cancelled.".into());
        }
        if process.is_some() {
            return Err("Stop the active integrated model before switching models.".into());
        }
        let runtime = launch(&executable, &model, &model_id)?;
        let endpoint = (runtime.base_url.clone(), runtime.key.clone());
        *process = Some(runtime);
        endpoint
    };
    for _ in 0..120 {
        {
            let state = app.state::<IntegratedRuntime>();
            let mut process = state.0.lock().map_err(|_| "Runtime state unavailable.")?;
            let runtime = process
                .as_mut()
                .filter(|p| p.key == key)
                .ok_or("Runtime startup was cancelled.")?;
            if runtime
                .child
                .try_wait()
                .map_err(|_| "Couldn't check runtime status.")?
                .is_some()
            {
                process.take();
                return Err(
                    "Runtime exited while loading. Check available RAM and runtime DLLs.".into(),
                );
            }
        }
        if let Ok(response) = client
            .get(format!("{base}/v1/models"))
            .bearer_auth(&key)
            .send()
            .await
        {
            if response.status().is_success() {
                let state = app.state::<IntegratedRuntime>();
                let mut process = state.0.lock().map_err(|_| "Runtime state unavailable.")?;
                if !process.as_ref().is_some_and(|p| p.key == key) {
                    return Err("Runtime startup was cancelled.".into());
                }
                process.as_mut().unwrap().ready = true;
                return Ok(());
            }
        }
        tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(std::time::Duration::from_millis(500))
        })
        .await
        .map_err(|_| "Runtime startup interrupted.")?;
    }
    let state = app.state::<IntegratedRuntime>();
    let mut process = state.0.lock().map_err(|_| "Runtime state unavailable.")?;
    if process.as_ref().is_some_and(|p| p.key == key) {
        process.take();
    }
    Err("Runtime took too long to load. Close other programs or choose the smaller model.".into())
}

#[tauri::command]
pub fn stop_integrated_runtime(state: tauri::State<'_, IntegratedRuntime>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub fn integrated_runtime_model(
    state: tauri::State<'_, IntegratedRuntime>,
) -> Result<Option<String>, String> {
    let mut process = state.0.lock().map_err(|_| "Runtime state unavailable.")?;
    if let Some(active) = process.as_mut() {
        if active
            .child
            .try_wait()
            .map_err(|_| "Couldn't check runtime status.")?
            .is_some()
        {
            process.take();
            return Ok(None);
        }
    }
    Ok(process
        .as_ref()
        .filter(|p| p.ready)
        .map(|p| p.model_id.clone()))
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamEvent {
    request_id: String,
    bytes: Vec<u8>,
    started: bool,
}

#[tauri::command]
pub async fn integrated_chat_stream(
    window: tauri::Window,
    runtime: tauri::State<'_, IntegratedRuntime>,
    registry: tauri::State<'_, super::CancelRegistry>,
    messages: serde_json::Value,
    request_id: String,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tauri::Emitter;
    let (base, key) = {
        let process = runtime.0.lock().map_err(|_| "Runtime state unavailable.")?;
        let active = process.as_ref().ok_or("Start an integrated model first.")?;
        if !active.ready {
            return Err("Integrated model is still loading.".into());
        }
        (active.base_url.clone(), active.key.clone())
    };
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|_| "Couldn't create local runtime client.")?;
    let notify = super::register_cancel_notify(&registry, &request_id);
    let result = async {
        window
            .emit(
                "integrated-chat-stream",
                StreamEvent {
                    request_id: request_id.clone(),
                    bytes: vec![],
                    started: true,
                },
            )
            .map_err(|_| "Couldn't register runtime stream listener.")?;
        let response = tokio::select! {
            _ = notify.notified() => return Err("Cancelled.".to_string()),
            result = client.post(format!("{base}/v1/chat/completions"))
                .bearer_auth(key).json(&serde_json::json!({
                    "messages": messages, "stream": true, "max_tokens": 2048,
                    "temperature": 0.6
                })).send() => result.map_err(|_| "Couldn't reach integrated runtime.")?,
        };
        if !response.status().is_success() {
            return Err(format!("Runtime returned HTTP {}.", response.status()));
        }
        let mut stream = response.bytes_stream();
        loop {
            let next = tokio::select! {
                _ = notify.notified() => return Err("Cancelled.".to_string()),
                next = stream.next() => next,
            };
            let Some(next) = next else {
                break;
            };
            let bytes = next.map_err(|_| "Integrated runtime stream failed.")?;
            window
                .emit(
                    "integrated-chat-stream",
                    StreamEvent {
                        request_id: request_id.clone(),
                        bytes: bytes.to_vec(),
                        started: false,
                    },
                )
                .map_err(|_| "Couldn't deliver integrated response.")?;
        }
        Ok(())
    }
    .await;
    super::unregister_cancel_notify(&registry, &request_id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unsupported_models_are_rejected() {
        assert!(model_artifact("../../unexpected.exe").is_err());
    }
    #[test]
    fn native_model_allowlist_matches_pinned_catalog() {
        let catalog: serde_json::Value =
            serde_json::from_str(include_str!("../../config/local-ai-artifacts.json")).unwrap();
        for model in catalog["models"].as_array().unwrap() {
            let (filename, size, hash) = model_artifact(model["id"].as_str().unwrap()).unwrap();
            assert_eq!(filename, model["filename"].as_str().unwrap());
            assert_eq!(size, model["bytes"].as_u64().unwrap());
            assert_eq!(hash, model["sha256"].as_str().unwrap());
        }
    }
    #[test]
    fn verifies_file_contents_and_size() {
        let path = std::env::temp_dir().join(format!("local-ed-model-test-{}", std::process::id()));
        std::fs::write(&path, b"abc").unwrap();
        let correct = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert!(verify_model(&path, 3, correct).is_ok());
        assert!(verify_model(&path, 4, correct).is_err());
        std::fs::write(&path, b"xyz").unwrap();
        assert!(verify_model(&path, 3, correct).is_err());
        std::fs::remove_file(path).unwrap();
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "Helper process for job cleanup test"]
    fn job_child() {
        if let Ok(path) = std::env::var("LOCAL_ED_JOB_TEST_READY") {
            std::fs::write(path, b"ready").unwrap();
        }
        std::thread::sleep(std::time::Duration::from_secs(30));
    }
    #[cfg(windows)]
    #[test]
    fn closing_job_terminates_owned_process() {
        use std::os::windows::process::CommandExt;
        let ready = std::env::temp_dir().join(format!("local-ed-job-ready-{}", std::process::id()));
        let _ = std::fs::remove_file(&ready);
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "integrated::tests::job_child", "--ignored"])
            .env("LOCAL_ED_JOB_TEST_READY", &ready)
            .creation_flags(0x08000000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let job = job::attach(&child).unwrap();
        let started = std::time::Instant::now();
        while !ready.exists() && started.elapsed() < std::time::Duration::from_secs(5) {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        assert!(
            ready.exists(),
            "Helper must enter its sleeping test before cleanup"
        );
        assert!(child.try_wait().unwrap().is_none());
        let stopped = std::time::Instant::now();
        drop(job);
        child.wait().unwrap();
        assert!(stopped.elapsed() < std::time::Duration::from_secs(5));
        std::fs::remove_file(ready).unwrap();
    }
}

#[derive(serde::Serialize)]
struct ModelStatus {
    id: String,
    filename: String,
    bytes: u64,
    installed: bool,
}
#[derive(serde::Serialize)]
pub struct SetupStatus {
    models: Vec<ModelStatus>,
    selected: Option<String>,
    active: Option<String>,
}
fn model_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Couldn't locate model storage.")?
        .join("models"))
}
// Read bundled weights in place without duplicating them into per-user storage.
fn available_model_path(app: &tauri::AppHandle, filename: &str, bytes: u64) -> Result<std::path::PathBuf, String> {
    let local = model_dir(app)?.join(filename);
    if std::fs::metadata(&local).is_ok_and(|m| m.len() == bytes) { return Ok(local); }
    let bundled = app.path().resource_dir().map_err(|_| "Couldn't locate bundled model.")?
        .join("local-ai-models").join(filename);
    if std::fs::metadata(&bundled).is_ok_and(|m| m.len() == bytes) { return Ok(bundled); }
    Ok(local)
}
#[tauri::command]
pub fn integrated_setup_status(app: tauri::AppHandle) -> Result<SetupStatus, String> {
    let dir = model_dir(&app)?;
    let mut models = Vec::new();
    for id in ["qwen3.5-4b-q4-k-m", "qwen3.5-2b-q4-k-m"] {
        let (filename, bytes, _) = model_artifact(id)?;
        let installed = std::fs::metadata(available_model_path(&app, filename, bytes)?).is_ok_and(|m| m.len() == bytes);
        models.push(ModelStatus {
            id: id.into(),
            filename: filename.into(),
            bytes,
            installed,
        });
    }
    let selected = std::fs::read_to_string(dir.join("selected-model.txt"))
        .ok()
        .filter(|id| model_artifact(id).is_ok())
        .or_else(|| models.iter().find(|m| m.id == "qwen3.5-4b-q4-k-m" && m.installed).map(|m| m.id.clone()));
    let active = integrated_runtime_model(app.state::<IntegratedRuntime>())?;
    Ok(SetupStatus {
        models,
        selected,
        active,
    })
}
#[tauri::command]
pub fn cancel_integrated_setup(runtime: tauri::State<'_, IntegratedRuntime>) {
    runtime.1.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut process) = runtime.0.lock() {
        if process.as_ref().is_some_and(|p| !p.ready) {
            process.take();
        }
    }
}
#[tauri::command]
pub async fn import_integrated_model(
    app: tauri::AppHandle,
    model_id: String,
    source: String,
) -> Result<(), String> {
    let (filename, size, hash) = model_artifact(&model_id)?;
    let state = app.state::<IntegratedRuntime>();
    let _operation = state
        .2
        .try_lock()
        .map_err(|_| "Another model setup is running.")?;
    let epoch = state.1.load(Ordering::SeqCst);
    let dir = model_dir(&app)?;
    let worker_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        std::fs::create_dir_all(&dir).map_err(|_| "Couldn't create model folder.")?;
        let destination = dir.join(filename);
        // Never replace an existing valid model; keep originals and active weights intact.
        if verify_model(&destination, size, hash).is_ok() {
            return Ok(());
        }
        let staging = dir.join(format!("{filename}.importing"));
        let result = (|| {
            let mut input =
                std::fs::File::open(&source).map_err(|_| "Couldn't open selected model.")?;
            if input
                .metadata()
                .map_err(|_| "Couldn't inspect selected model.")?
                .len()
                != size
            {
                return Err(
                    "This file has the wrong size. Choose the exact supported Q4_K_M GGUF.".into(),
                );
            }
            let mut output = std::fs::File::create(&staging)
                .map_err(|_| "Couldn't stage model. Check free disk space.")?;
            let mut digest = Sha256::new();
            let mut buffer = [0u8; 1024 * 1024];
            loop {
                if worker_app
                    .state::<IntegratedRuntime>()
                    .1
                    .load(Ordering::SeqCst)
                    != epoch
                {
                    return Err("Model import cancelled.".into());
                }
                let count = input
                    .read(&mut buffer)
                    .map_err(|_| "Couldn't read selected model.")?;
                if count == 0 {
                    break;
                }
                digest.update(&buffer[..count]);
                output
                    .write_all(&buffer[..count])
                    .map_err(|_| "Couldn't copy model. Check free disk space.")?;
            }
            output
                .sync_all()
                .map_err(|_| "Couldn't save staged model.")?;
            drop(output);
            if format!("{:x}", digest.finalize()) != hash {
                return Err("Model checksum mismatch. Existing models were preserved.".into());
            }
            if worker_app
                .state::<IntegratedRuntime>()
                .1
                .load(Ordering::SeqCst)
                != epoch
            {
                return Err("Model import cancelled.".into());
            }
            replace_staged(&staging, &destination)?;
            Ok(())
        })();
        let _ = std::fs::remove_file(&staging);
        result
    })
    .await
    .map_err(|_| "Model import interrupted.")?
}
fn replace_staged(staging: &Path, destination: &Path) -> Result<(), String> {
    let backup = destination.with_extension("previous");
    if destination.exists() {
        // A retained backup is evidence requiring recovery, never overwrite it.
        if backup.exists() {
            return Err("A previous model/setup backup exists. Preserve it and resolve recovery before replacing this file.".into());
        }
        std::fs::rename(destination, &backup)
            .map_err(|_| "Couldn't preserve previous model/setup.")?;
    }
    if std::fs::rename(staging, destination).is_err() {
        if backup.exists() {
            let _ = std::fs::rename(&backup, destination);
        }
        return Err("Couldn't activate staged model/setup. Previous state was retained.".into());
    }
    // Models retain their old file. Small selection metadata is recoverable until the next successful change.
    Ok(())
}
#[tauri::command]
pub async fn select_integrated_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<(), String> {
    let state = app.state::<IntegratedRuntime>();
    let _operation = state
        .2
        .try_lock()
        .map_err(|_| "Another model setup is running.")?;
    let (filename, bytes, hash) = model_artifact(&model_id)?;
    let epoch_before_verify = state.1.load(Ordering::SeqCst);
    if !app
        .state::<super::CancelRegistry>()
        .0
        .lock()
        .map_err(|_| "Request state unavailable.")?
        .is_empty()
    {
        return Err("Stop generating before switching models.".into());
    }
    let dir = model_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|_| "Could not create model settings folder.")?;
    let path = available_model_path(&app, filename, bytes)?;
    let verification_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        verify_model_cancel(&path, bytes, hash, || {
            verification_app
                .state::<IntegratedRuntime>()
                .1
                .load(Ordering::SeqCst)
                != epoch_before_verify
        })
    })
    .await
    .map_err(|_| "Verification interrupted.")??;
    let previous = integrated_runtime_model(app.state::<IntegratedRuntime>())?;
    if state.1.load(Ordering::SeqCst) != epoch_before_verify {
        return Err("Model loading cancelled.".into());
    }
    if previous.as_deref() == Some(&model_id) {
        return Ok(());
    }
    state.stop()?;
    let epoch = state.1.load(Ordering::SeqCst);
    if let Err(error) = start_integrated_runtime(app.clone(), model_id.clone()).await {
        if state.1.load(Ordering::SeqCst) == epoch {
            if let Some(old) = previous {
                let _ = start_integrated_runtime(app.clone(), old).await;
            }
        }
        return Err(error);
    }
    // Commit the selection only after the candidate loads successfully.
    let staging = dir.join("selected-model.pending");
    std::fs::write(&staging, model_id)
        .map_err(|_| "Model loaded but selection couldn't be saved.")?;
    let selection = dir.join("selected-model.txt");
    // Selection is tiny metadata, not weights or teacher data. Keep one previous selection.
    let backup = selection.with_extension("previous");
    if backup.exists() {
        std::fs::remove_file(&backup).map_err(|_| "Couldn't rotate selection backup.")?;
    }
    replace_staged(&staging, &selection)?;
    Ok(())
}

#[cfg(test)]
mod setup_tests {
    use super::*;
    #[test]
    fn cancelled_verification_rejects_valid_file() {
        let path = std::env::temp_dir().join(format!("local-ed-cancel-{}", std::process::id()));
        std::fs::write(&path, b"abc").unwrap();
        assert!(verify_model_cancel(
            &path,
            3,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            || true
        )
        .unwrap_err()
        .contains("cancelled"));
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn activation_failure_restores_original_and_success_retains_backup() {
        let dir = std::env::temp_dir().join(format!("local-ed-activation-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let destination = dir.join("model.gguf");
        let staging = dir.join("candidate");
        std::fs::write(&destination, b"old").unwrap();
        assert!(replace_staged(&staging, &destination).is_err());
        assert_eq!(std::fs::read(&destination).unwrap(), b"old");
        std::fs::write(&staging, b"new").unwrap();
        replace_staged(&staging, &destination).unwrap();
        assert_eq!(std::fs::read(&destination).unwrap(), b"new");
        assert_eq!(
            std::fs::read(destination.with_extension("previous")).unwrap(),
            b"old"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}
