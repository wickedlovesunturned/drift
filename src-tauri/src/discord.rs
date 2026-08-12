use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, Button, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresencePayload {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub cover_url: Option<String>,
    pub server_url: String,
    pub client_id: String,
    pub fallback_image_key: String,
    #[serde(default)]
    pub paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordStatus {
    pub connected: bool,
    pub enabled: bool,
    pub last_error: Option<String>,
}

pub struct DiscordState {
    client: Option<DiscordIpcClient>,
    client_id: Option<String>,
    last_error: Option<String>,
    last_payload: Option<PresencePayload>,
}

impl DiscordState {
    pub fn new() -> Self {
        Self {
            client: None,
            client_id: None,
            last_error: None,
            last_payload: None,
        }
    }
}

pub type SharedDiscord = Mutex<DiscordState>;

/// AMWin-RP / Lachee DiscordRPC use Unix milliseconds for timestamps.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn is_private_host(host: &str) -> bool {
    let lower = host.to_ascii_lowercase();
    if lower == "localhost" || lower.ends_with(".local") || lower.ends_with(".lan") {
        return true;
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(v4) => {
                v4.is_private() || v4.is_loopback() || v4.is_link_local() || v4.is_unspecified()
            }
            IpAddr::V6(v6) => v6.is_loopback() || v6.is_unspecified(),
        };
    }
    false
}

fn resolve_large_image(cover_url: Option<&str>, fallback_key: &str) -> String {
    let fallback = fallback_key.trim();
    let Some(raw) = cover_url.map(str::trim).filter(|s| !s.is_empty()) else {
        return fallback.to_string();
    };
    let Ok(parsed) = Url::parse(raw) else {
        return fallback.to_string();
    };
    // Discord only fetches public HTTPS image URLs (same pattern as AMWin-RP).
    if parsed.scheme() != "https" {
        return fallback.to_string();
    }
    match parsed.host_str() {
        Some(host) if !is_private_host(host) => raw.to_string(),
        _ => fallback.to_string(),
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(3)).collect::<String>() + "..."
    }
}

fn pad_min2(s: String) -> String {
    if s.chars().count() >= 2 {
        s
    } else {
        format!("{s}\0")
    }
}

struct OwnedActivityParts {
    details: String,
    state: String,
    large_image: String,
    large_text: String,
    start: Option<i64>,
    end: Option<i64>,
    button_url: Option<String>,
}

fn parts_from_payload(payload: &PresencePayload) -> OwnedActivityParts {
    let (start, end) = if !payload.paused && payload.duration_ms > 0 {
        let now = now_ms();
        let start = now - payload.position_ms as i64;
        let end = start + payload.duration_ms as i64;
        (Some(start), Some(end))
    } else {
        (None, None)
    };

    // Discord buttons require https:// URLs. Never attach http:// (would fail SET_ACTIVITY).
    let button_url = {
        let url = payload.server_url.trim();
        if url.starts_with("https://") {
            Some(url.to_string())
        } else {
            None
        }
    };

    OwnedActivityParts {
        details: pad_min2(truncate(&payload.title, 128)),
        state: pad_min2(truncate(&payload.artist, 128)),
        large_image: resolve_large_image(payload.cover_url.as_deref(), &payload.fallback_image_key),
        large_text: pad_min2(truncate(&payload.album, 128)),
        start,
        end,
        button_url,
    }
}

fn ensure_connected(state: &mut DiscordState, client_id: &str) -> Result<(), String> {
    let client_id = client_id.trim();
    if client_id.is_empty() {
        return Err("Discord Application Client ID is not set. Add it in Settings.".to_string());
    }

    let needs_new = match (&state.client, &state.client_id) {
        (Some(_), Some(id)) => id != client_id,
        _ => true,
    };

    if needs_new {
        if let Some(mut old) = state.client.take() {
            let _ = old.clear_activity();
            let _ = old.close();
        }
        let mut client = DiscordIpcClient::new(client_id);
        // Connect scans discord-ipc-0 .. discord-ipc-9 named pipes (Windows).
        client.connect().map_err(|e| {
            let msg = format!(
                "Could not connect to Discord IPC ({e}). Is Discord desktop running and not in admin-only mode?"
            );
            state.last_error = Some(msg.clone());
            msg
        })?;
        state.client = Some(client);
        state.client_id = Some(client_id.to_string());
        state.last_error = None;
        eprintln!("[discord] connected with client_id={client_id}");
    }

    Ok(())
}

fn set_activity_with_parts(
    client: &mut DiscordIpcClient,
    parts: &OwnedActivityParts,
    with_buttons: bool,
    listening: bool,
) -> Result<(), String> {
    let mut assets = Assets::new();
    if !parts.large_image.is_empty() {
        assets = assets.large_image(parts.large_image.as_str());
    }
    if !parts.large_text.is_empty() {
        assets = assets.large_text(parts.large_text.as_str());
    }

    let mut activity = Activity::new()
        .details(parts.details.as_str())
        .state(parts.state.as_str())
        .assets(assets);

    activity = if listening {
        activity.activity_type(ActivityType::Listening)
    } else {
        activity.activity_type(ActivityType::Playing)
    };

    if let (Some(start), Some(end)) = (parts.start, parts.end) {
        activity = activity.timestamps(Timestamps::new().start(start).end(end));
    }

    if with_buttons {
        if let Some(ref url) = parts.button_url {
            activity = activity.buttons(vec![Button::new("Open drift", url.as_str())]);
        }
    }

    client.set_activity(activity).map_err(|e| e.to_string())
}

pub fn set_presence(state: &SharedDiscord, payload: PresencePayload) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    ensure_connected(&mut guard, &payload.client_id)?;

    let parts = parts_from_payload(&payload);
    let client = guard
        .client
        .as_mut()
        .ok_or_else(|| "Discord client not connected".to_string())?;

    // Prefer Listening (AMWin-RP). Fall back: no buttons, then Playing type, then reconnect.
    let attempts: [(bool, bool); 3] = [
        (parts.button_url.is_some(), true),
        (false, true),
        (false, false),
    ];

    let mut last_err = None;
    for (with_buttons, listening) in attempts {
        match set_activity_with_parts(client, &parts, with_buttons, listening) {
            Ok(()) => {
                guard.last_error = None;
                guard.last_payload = Some(payload);
                eprintln!(
                    "[discord] presence set title={} artist={} listening={listening} buttons={with_buttons}",
                    parts.details, parts.state
                );
                return Ok(());
            }
            Err(e) => {
                eprintln!("[discord] set_activity failed: {e}");
                last_err = Some(e);
            }
        }
    }

    // Stale pipe - reconnect once
    guard.client = None;
    ensure_connected(&mut guard, &payload.client_id)?;
    let client = guard
        .client
        .as_mut()
        .ok_or_else(|| "Discord client not connected".to_string())?;
    match set_activity_with_parts(client, &parts, false, true) {
        Ok(()) => {
            guard.last_error = Some("Reconnected to Discord IPC".to_string());
            guard.last_payload = Some(payload);
            Ok(())
        }
        Err(e) => {
            let msg = last_err.unwrap_or(e);
            guard.last_error = Some(msg.clone());
            Err(msg)
        }
    }
}

pub fn clear_presence(state: &SharedDiscord) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.last_payload = None;
    if let Some(client) = guard.client.as_mut() {
        let _ = client.clear_activity();
    }
    Ok(())
}

pub fn connect_only(state: &SharedDiscord, client_id: &str) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    ensure_connected(&mut guard, client_id)
}

pub fn status(state: &SharedDiscord, enabled: bool) -> DiscordStatus {
    let guard = match state.lock() {
        Ok(g) => g,
        Err(e) => {
            return DiscordStatus {
                connected: false,
                enabled,
                last_error: Some(e.to_string()),
            }
        }
    };
    DiscordStatus {
        connected: guard.client.is_some(),
        enabled,
        last_error: guard.last_error.clone(),
    }
}
