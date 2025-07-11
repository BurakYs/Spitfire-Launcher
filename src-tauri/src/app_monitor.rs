use crate::types::{AppState, AppStateEvent, TrackedApp};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};

static TRACKED_APPS: LazyLock<Mutex<HashMap<u32, TrackedApp>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn track_app(pid: u32, app_id: &str) {
    let app = TrackedApp {
        pid,
        app_id: app_id.to_string(),
        is_running: true,
    };

    let mut apps = TRACKED_APPS.lock().unwrap();
    apps.insert(pid, app);
}

pub fn emit_app_state_changed(app: &AppHandle, pid: u32, app_id: &str, state: AppState) {
    let event = AppStateEvent {
        pid,
        app_id: app_id.to_string(),
        state,
    };

    let _ = app.emit("app_state_changed", &event);
}

pub fn stop_app(app_id: &str) -> Result<bool, String> {
    let mut apps = TRACKED_APPS.lock().unwrap();
    if let Some(tracked_app) = apps.values_mut().find(|a| a.app_id == app_id) {
        let pid = tracked_app.pid;
        let mut system = System::new();

        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
            true,
            ProcessRefreshKind::nothing(),
        );

        if let Some(process) = system.process(Pid::from_u32(pid)) {
            process.kill();
        }

        Ok(true)
    } else {
        Err(format!("App with ID '{}' not found", app_id))
    }
}

pub fn start_monitoring(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut system = System::new();

        loop {
            sleep(Duration::from_secs(2)).await;

            let tracked_pids: Vec<u32> = {
                let apps = TRACKED_APPS.lock().unwrap();
                apps.keys().cloned().collect()
            };

            if tracked_pids.is_empty() {
                continue;
            }

            let pids_to_check: Vec<Pid> =
                tracked_pids.iter().map(|&pid| Pid::from_u32(pid)).collect();

            system.refresh_processes_specifics(
                ProcessesToUpdate::Some(&pids_to_check),
                true,
                ProcessRefreshKind::nothing(),
            );

            for pid in tracked_pids {
                let process_exists = system.process(Pid::from_u32(pid)).is_some();

                if !process_exists {
                    let should_emit = {
                        let mut apps = TRACKED_APPS.lock().unwrap();
                        if let Some(tracked_app) = apps.get_mut(&pid) {
                            if tracked_app.is_running {
                                tracked_app.is_running = false;
                                emit_app_state_changed(
                                    &app,
                                    pid,
                                    &tracked_app.app_id,
                                    AppState::Stopped,
                                );

                                true
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    };

                    if should_emit {
                        tauri::async_runtime::spawn(async move {
                            sleep(Duration::from_secs(1)).await;
                            let mut apps = TRACKED_APPS.lock().unwrap();
                            apps.remove(&pid);
                        });
                    }
                }
            }
        }
    });
}
