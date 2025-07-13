use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AppState {
    Running,
    Stopped,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppStateEvent {
    pub pid: u32,
    pub app_id: String,
    pub state: AppState,
}

#[derive(Debug, Clone)]
pub struct TrackedApp {
    pub pid: u32,
    pub app_id: String,
    pub is_running: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DiskSpace {
    pub total: u64,
    pub available: u64,
}
