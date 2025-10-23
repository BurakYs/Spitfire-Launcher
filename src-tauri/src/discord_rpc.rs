use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static RPC_CLIENT: Mutex<Option<DiscordIpcClient>> = Mutex::new(None);
static START_TIMESTAMP: Mutex<Option<i64>> = Mutex::new(None);

pub fn connect(client_id: &str) {
    let mut client_opt = RPC_CLIENT.lock().unwrap();
    if client_opt.is_some() {
        return;
    }

    let mut client = DiscordIpcClient::new(client_id);
    if client.connect().is_err() {
        return;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    *START_TIMESTAMP.lock().unwrap() = Some(timestamp);
    *client_opt = Some(client);
}

pub fn update_activity(details: Option<&str>, state: Option<&str>) {
    let mut client_opt = RPC_CLIENT.lock().unwrap();

    let client = match client_opt.as_mut() {
        Some(c) => c,
        None => return,
    };

    let mut builder = activity::Activity::new()
        .assets(
            activity::Assets::new()
                .large_image("launcher-icon")
                .large_text("Spitfire Launcher"),
        )
        .buttons(vec![activity::Button::new(
            "Download",
            "https://rookie-spitfire.xyz/launcher",
        )]);

    if let Some(&timestamp) = START_TIMESTAMP.lock().unwrap().as_ref() {
        builder = builder.timestamps(activity::Timestamps::new().start(timestamp));
    }

    if let Some(details) = details {
        builder = builder.details(details);
    }

    if let Some(state) = state {
        builder = builder.state(state);
    }

    let _ = client.set_activity(builder);
}

pub fn disconnect() {
    let mut client_opt = RPC_CLIENT.lock().unwrap();
    if let Some(mut client) = client_opt.take() {
        let _ = client.close();
    }

    *START_TIMESTAMP.lock().unwrap() = None;
}
