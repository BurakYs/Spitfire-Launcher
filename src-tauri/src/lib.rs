use tauri::generate_handler;
#[cfg(desktop)]
use tauri::Manager;
use tauri_plugin_prevent_default::{Builder as PreventDefaultBuilder, Flags, KeyboardShortcut};

#[cfg(windows)]
mod app_monitor;
#[cfg(windows)]
mod legendary;

mod commands;
mod types;
#[cfg(desktop)]
mod discord_rpc;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    let mut builder = tauri::Builder::default();

    #[cfg(not(desktop))]
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = app
                    .get_webview_window("main")
                    .expect("no main window")
                    .set_focus();
            }))
    }

    #[cfg(windows)]
    {
        builder = builder
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

    let prevent = PreventDefaultBuilder::new()
        .shortcut(KeyboardShortcut::new("F5"))
        .with_flags(Flags::all().difference(Flags::RELOAD | Flags::DEV_TOOLS))
        .build();

    builder
        .invoke_handler(generate_handler![
            get_locale,
            #[cfg(windows)] run_legendary,
            #[cfg(windows)] start_legendary_stream,
            #[cfg(windows)] stop_legendary_stream,
            #[cfg(windows)] launch_app,
            #[cfg(windows)] stop_app,
            #[cfg(windows)] get_tracked_apps,
            #[cfg(windows)] get_disk_space,
            #[cfg(desktop)] connect_discord_rpc,
            #[cfg(desktop)] update_discord_rpc,
            #[cfg(desktop)] disconnect_discord_rpc
        ])
        .plugin(prevent)
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
