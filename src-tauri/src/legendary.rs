use crate::types::{CommandOutput, EventType, StreamEvent};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, Signal, System};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

static ACTIVE_STREAMS: LazyLock<Mutex<HashMap<String, CommandChild>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub async fn run_legendary(app: AppHandle, args: Vec<String>) -> Result<CommandOutput, String> {
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
            _ => continue,
        }
    }

    Ok(CommandOutput {
        code: None,
        signal: None,
        stdout: stdout.trim().to_string(),
        stderr: stderr.trim().to_string(),
    })
}

pub async fn start_legendary_stream(
    app: AppHandle,
    stream_id: String,
    args: Vec<String>,
) -> Result<String, String> {
    let sidecar = create_legendary_sidecar(&app, args)?;
    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;

    {
        let mut streams = ACTIVE_STREAMS.lock().unwrap();
        streams.insert(stream_id.clone(), child);
    }

    let stream_id_clone = stream_id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
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
                }
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
                }
                _ => continue,
            };

            let _ = app_clone.emit(&event_name, &stream_event);
        }
    });

    Ok(stream_id)
}

pub async fn stop_legendary_stream(
    stream_id: String,
    force_kill_all: bool,
) -> Result<bool, String> {
    if force_kill_all {
        kill_legendary_processes();
        return Ok(true);
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

fn create_legendary_sidecar(
    app: &AppHandle,
    args: Vec<String>,
) -> Result<tauri_plugin_shell::process::Command, String> {
    let config_path = app
        .path()
        .data_dir()
        .map_err(|e| e.to_string())?
        .join("spitfire-launcher")
        .join("legendary")
        .to_string_lossy()
        .to_string();

    Ok(app
        .shell()
        .sidecar("legendary")
        .map_err(|e| e.to_string())?
        .args(args)
        .env("LEGENDARY_CONFIG_PATH", config_path))
}

pub fn kill_legendary_processes() {
    {
        let streams = ACTIVE_STREAMS.lock().unwrap();
        if streams.is_empty() {
            return;
        }
    }

    let mut system = System::new_all();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    for (_, process) in system.processes() {
        let process_name = if cfg!(windows) {
            "legendary.exe"
        } else {
            "legendary"
        };

        if process.name().eq(process_name) {
            process.kill_with(Signal::Kill);
        }
    }

    {
        let mut streams = ACTIVE_STREAMS.lock().unwrap();
        streams.clear();
    }
}
