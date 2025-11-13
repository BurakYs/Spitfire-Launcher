#[cfg(windows)]
use {
	serde::{Deserialize, Serialize},
	std::collections::HashMap,
};

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandOutput {
    pub code: Option<i32>,
    pub signal: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Stdout,
    Stderr,
    Terminated,
    Error,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamEvent {
    pub stream_id: String,
    pub event_type: EventType,
    pub data: String,
    pub code: Option<i32>,
    pub signal: Option<i32>,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchData {
    pub game_id: String,
    pub game_parameters: Vec<String>,
    pub game_executable: String,
    pub game_directory: String,
    pub egl_parameters: Vec<String>,
    pub launch_command: Vec<String>,
    pub working_directory: String,
    pub user_parameters: Vec<String>,
    pub environment: HashMap<String, String>,
    pub pre_launch_command: String,
    pub pre_launch_wait: bool,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AppState {
    Running,
    Stopped,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppStateEvent {
    pub pid: u32,
    pub app_id: String,
    pub state: AppState,
}

#[cfg(windows)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TrackedApp {
    pub pid: u32,
    pub app_id: String,
    pub is_running: bool,
}

#[cfg(windows)]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DiskSpace {
    pub total: u64,
    pub available: u64,
}
