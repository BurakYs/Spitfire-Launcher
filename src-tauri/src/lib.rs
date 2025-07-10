use sysinfo::{Signal, System, ProcessesToUpdate, ProcessRefreshKind};
use tauri::{generate_handler, Manager, AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, LazyLock};
use tokio;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandOutput {
    pub code: Option<i32>,
    pub signal: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Stdout,
    Stderr,
    Terminated,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamEvent {
    pub stream_id: String,
    pub event_type: EventType,
    pub data: String,
    pub code: Option<i32>,
    pub signal: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StreamInfo {
    pub stream_id: String,
}

static ACTIVE_STREAMS: LazyLock<Mutex<HashMap<String, CommandChild>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
fn get_processes() -> Vec<String> {
    let mut system = System::new_all();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    system
        .processes()
        .iter()
        .map(|(pid, process)| format!("{} - {}", pid, process.name().to_string_lossy()))
        .collect()
}

#[tauri::command]
fn get_locale() -> String {
    sys_locale::get_locale()
        .and_then(|locale| locale.split(['_', '-']).next().map(|s| s.to_string()))
        .unwrap_or_else(|| "en".to_string())
}

#[tauri::command]
async fn run_legendary(app: AppHandle, args: Vec<String>) -> Result<CommandOutput, String> {
    let sidecar = create_legendary_sidecar(&app, args)?;
    let (mut rx, _child) = sidecar.spawn().map_err(|e| e.to_string())?;

    let mut stdout = String::new();
    let mut stderr = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                stdout.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Stderr(bytes) => {
                stderr.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Terminated(payload) => {
                return Ok(CommandOutput {
                    code: payload.code,
                    signal: payload.signal,
                    stdout: stdout.trim().to_string(),
                    stderr: stderr.trim().to_string(),
                });
            }
            CommandEvent::Error(error) => {
                return Err(format!("Command error: {}", error));
            }
            _ => {
                continue;
            }
        }
    }

    Ok(CommandOutput {
        code: None,
        signal: None,
        stdout: stdout.trim().to_string(),
        stderr: stderr.trim().to_string(),
    })
}

#[tauri::command]
async fn start_legendary_stream(app: AppHandle, stream_id: String, args: Vec<String>) -> Result<String, String> {
    let sidecar = create_legendary_sidecar(&app, args)?;
    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;

    {
        let mut streams = ACTIVE_STREAMS.lock().unwrap();
        streams.insert(stream_id.clone(), child);
    }

    let stream_id_clone = stream_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let event_name = format!("legendary_stream:{}", stream_id_clone);

        while let Some(event) = rx.recv().await {
            let stream_event = match event {
                CommandEvent::Stdout(bytes) => StreamEvent {
                    stream_id: stream_id_clone.clone(),
                    event_type: EventType::Stdout,
                    data: String::from_utf8_lossy(&bytes).to_string(),
                    code: None,
                    signal: None,
                },
                CommandEvent::Stderr(bytes) => StreamEvent {
                    stream_id: stream_id_clone.clone(),
                    event_type: EventType::Stderr,
                    data: String::from_utf8_lossy(&bytes).to_string(),
                    code: None,
                    signal: None,
                },
                CommandEvent::Terminated(payload) => {
                    let event = StreamEvent {
                        stream_id: stream_id_clone.clone(),
                        event_type: EventType::Terminated,
                        data: String::new(),
                        code: payload.code,
                        signal: payload.signal,
                    };

                    {
                        let mut streams = ACTIVE_STREAMS.lock().unwrap();
                        streams.remove(&stream_id_clone);
                    }

                    let _ = app_clone.emit(&event_name, &event);
                    break;
                },
                CommandEvent::Error(error) => {
                    let event = StreamEvent {
                        stream_id: stream_id_clone.clone(),
                        event_type: EventType::Error,
                        data: error,
                        code: None,
                        signal: None,
                    };

                    {
                        let mut streams = ACTIVE_STREAMS.lock().unwrap();
                        streams.remove(&stream_id_clone);
                    }

                    let _ = app_clone.emit(&event_name, &event);
                    break;
                },
                _ => continue,
            };

            let _ = app_clone.emit(&event_name, &stream_event);
        }
    });

    Ok(stream_id)
}

#[tauri::command]
async fn stop_legendary_stream(stream_id: String, force_kill_all: bool) -> Result<bool, String> {
    if force_kill_all {
        return kill_legendary_processes();
    } else {
        let child = {
            let mut streams = ACTIVE_STREAMS.lock().unwrap();
            streams.remove(&stream_id)
        };

        if let Some(child) = child {
            match child.kill() {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Failed to kill process: {}", e)),
            }
        } else {
            Ok(false)
        }
    }
}

fn create_legendary_sidecar(app: &AppHandle, args: Vec<String>) -> Result<tauri_plugin_shell::process::Command, String> {
    let config_path = app.path()
        .data_dir()
        .map_err(|e| e.to_string())?
        .join("spitfire-launcher")
        .join("legendary")
        .to_string_lossy()
        .to_string();

    Ok(app.shell()
        .sidecar("legendary")
        .map_err(|e| e.to_string())?
        .args(args)
        .env("LEGENDARY_CONFIG_PATH", config_path))
}

fn kill_legendary_processes() -> Result<bool, String> {
    {
        let streams = ACTIVE_STREAMS.lock().unwrap();
        if streams.is_empty() {
            return Ok(true);
        }
    }

    let mut system = System::new_all();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    let mut count = 0;
    for (_, process) in system.processes() {
        let process_name = if cfg!(windows) { "legendary.exe" } else { "legendary" };
        if process.name().eq(process_name) {
            process.kill_with(Signal::Kill);
            count += 1;
        }
    }

    {
        let mut streams = ACTIVE_STREAMS.lock().unwrap();
        streams.clear();
    }

    Ok(count > 0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = app
                    .get_webview_window("main")
                    .expect("no main window")
                    .set_focus();
            }))
            .on_window_event(|_window, event| {
                if let tauri::WindowEvent::Destroyed = event {
                    let _ = kill_legendary_processes();
                }
            });
    }

    builder
        .invoke_handler(generate_handler![
            get_processes,
            get_locale,
            run_legendary,
            start_legendary_stream,
            stop_legendary_stream
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_websocket::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}