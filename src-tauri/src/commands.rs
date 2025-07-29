#[cfg(desktop)]
use {
    crate::app_monitor,
    crate::legendary,
    crate::types::{AppState, CommandOutput, DiskSpace, LaunchData},
    fs2, shlex,
    std::path::Path,
    tauri::AppHandle,
    tauri_plugin_shell::ShellExt,
};

use tauri::command;

#[command]
pub fn get_locale() -> String {
    sys_locale::get_locale()
        .and_then(|locale| locale.split(['_', '-']).next().map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string())
}

#[cfg(desktop)]
#[command]
pub fn get_disk_space(dir: String) -> Result<DiskSpace, String> {
    let path = Path::new(&dir);

    match (fs2::total_space(path), fs2::available_space(path)) {
        (Ok(total), Ok(available)) => {
            let disk_space = DiskSpace { total, available };

            Ok(disk_space)
        }
        (Err(e), _) | (_, Err(e)) => Err(e.to_string()),
    }
}

#[cfg(desktop)]
#[command]
pub async fn launch_app(app: AppHandle, launch_data: LaunchData) -> Result<u32, String> {
    if !launch_data.pre_launch_command.is_empty() {
        let pre_launch_result = execute_pre_launch_command(&app, &launch_data).await;
        if let Err(e) = pre_launch_result {
            return Err(format!("Pre-launch command failed: {}", e));
        }
    }

    let pid = launch_application(&app, &launch_data).await?;

    app_monitor::track_app(pid, &launch_data.game_id);
    app_monitor::emit_app_state_changed(&app, pid, &launch_data.game_id, AppState::Running);

    Ok(pid)
}

#[cfg(desktop)]
#[command]
pub async fn stop_app(_app: AppHandle, app_id: String) -> Result<bool, String> {
    app_monitor::stop_app(&app_id)
}

#[cfg(desktop)]
#[command]
pub async fn run_legendary(app: AppHandle, args: Vec<String>) -> Result<CommandOutput, String> {
    legendary::run_legendary(app, args).await
}

#[cfg(desktop)]
#[command]
pub async fn start_legendary_stream(
    app: AppHandle,
    stream_id: String,
    args: Vec<String>,
) -> Result<String, String> {
    legendary::start_legendary_stream(app, stream_id, args).await
}

#[cfg(desktop)]
#[command]
pub async fn stop_legendary_stream(
    stream_id: String,
    force_kill_all: bool,
) -> Result<bool, String> {
    legendary::stop_legendary_stream(stream_id, force_kill_all).await
}

#[cfg(desktop)]
async fn execute_pre_launch_command(
    app: &AppHandle,
    launch_data: &LaunchData,
) -> Result<(), String> {
    let shell = app.shell();

    let command_parts = shlex::split(&launch_data.pre_launch_command)
        .ok_or_else(|| "Invalid command format".to_string())?;

    if command_parts.is_empty() {
        return Ok(());
    }

    let program = &command_parts[0];
    let args = if command_parts.len() > 1 {
        command_parts[1..].to_vec()
    } else {
        vec![]
    };

    let mut command = shell.command(program).args(args);

    if !launch_data.working_directory.is_empty()
        && Path::new(&launch_data.working_directory).exists()
    {
        command = command.current_dir(&launch_data.working_directory);
    }

    for (key, value) in &launch_data.environment {
        command = command.env(key, value);
    }

    if launch_data.pre_launch_wait {
        let (mut rx, _child) = command.spawn().map_err(|e| e.to_string())?;

        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    if payload.code.unwrap_or(1) != 0 {
                        return Err(format!(
                            "Pre-launch command exited with code: {:?}",
                            payload.code
                        ));
                    }
                    return Ok(());
                }
                tauri_plugin_shell::process::CommandEvent::Error(error) => {
                    return Err(format!("Pre-launch command error: {}", error));
                }
                _ => continue,
            }
        }
    } else {
        let (_rx, _child) = command.spawn().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(desktop)]
async fn launch_application(app: &AppHandle, launch_data: &LaunchData) -> Result<u32, String> {
    let shell = app.shell();

    let executable_path = Path::new(&launch_data.game_directory).join(&launch_data.game_executable);

    if !executable_path.exists() {
        return Err(format!(
            "App executable not found: {}",
            executable_path.display()
        ));
    }

    let mut command = shell
        .command(executable_path.to_string_lossy().to_string())
        .args(&launch_data.game_parameters)
        .args(&launch_data.user_parameters)
        .args(&launch_data.egl_parameters);

    if !launch_data.working_directory.is_empty()
        && Path::new(&launch_data.working_directory).exists()
    {
        command = command.current_dir(&launch_data.working_directory);
    }

    for (key, value) in &launch_data.environment {
        command = command.env(key, value);
    }

    let (_rx, child) = command.spawn().map_err(|e| e.to_string())?;

    let pid = child.pid();

    Ok(pid)
}
