use tauri::{generate_handler, Manager};

mod app_monitor;
mod commands;
mod legendary;
mod types;

use commands::*;

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
            .setup(|app| {
                app_monitor::start_monitoring(app.handle().clone());
                Ok(())
            })
            .on_window_event(|_window, event| {
                if let tauri::WindowEvent::Destroyed = event {
                    let _ = legendary::kill_legendary_processes();
                }
            });
    }

    builder
        .invoke_handler(generate_handler![
            get_processes,
            get_locale,
            run_legendary,
            start_legendary_stream,
            stop_legendary_stream,
            launch_app,
            stop_app
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
