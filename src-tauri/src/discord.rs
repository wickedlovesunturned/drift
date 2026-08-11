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

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
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

/// Prefer public HTTPS cover URLs as LargeImageKey (AMWin-RP pattern); else portal asset.
pub fn resolve_large_image(cover_url: Option<&str>, fallback_key: &str) -> String {
    let Some(raw) = cover_url.map(str::trim).filter(|s| !s.is_empty()) else {
        return fallback_key.to_string();
    };
    let Ok(parsed) = Url::parse(raw) else {
        return fallback_key.to_string();
    };
    if parsed.scheme() != "https" {
        return fallback_key.to_string();
    }
    match parsed.host_str() {
        Some(host) if !is_private_host(host) => raw.to_string(),
        _ => fallback_key.to_string(),
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "..."
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
    // AMWin-RP style: PlaybackStart = now - position, PlaybackEnd = now + remaining
    let (start, end) = if !payload.paused && payload.duration_ms > 0 {
        let pos_s = (payload.position_ms / 1000) as i64;
        let dur_s = (payload.duration_ms / 1000) as i64;
        let now = now_secs();
        (Some(now - pos_s), Some(now + (dur_s - pos_s).max(0)))
    } else {
        (None, None)
    };

    OwnedActivityParts {
        details: truncate(&payload.title, 128),
        state: truncate(&payload.artist, 128),
        large_image: resolve_large_image(payload.cover_url.as_deref(), &payload.fallback_image_key),
        large_text: truncate(&payload.album, 128),
        start,
        end,
        button_url: {
            let url = payload.server_url.trim();
            if url.starts_with("http://") || url.starts_with("https://") {
                Some(url.to_string())
            } else {
                None
            }
        },
    }
}

fn ensure_connected(state: &mut DiscordState, client_id: &str) -> Result<(), String> {
    if client_id.trim().is_empty() {
        return Err("Discord Application Client ID is not set".to_string());
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
        client.connect().map_err(|e| {
            state.last_error = Some(e.to_string());
            e.to_string()
        })?;
        state.client = Some(client);
        state.client_id = Some(client_id.to_string());
        state.last_error = None;
    }

    Ok(())
}

fn set_activity_with_parts(
    client: &mut DiscordIpcClient,
    parts: &OwnedActivityParts,
    with_buttons: bool,
) -> Result<(), String> {
    let assets = Assets::new()
        .large_image(parts.large_image.as_str())
        .large_text(parts.large_text.as_str());

    let mut activity = Activity::new()
        .activity_type(ActivityType::Listening)
        .details(parts.details.as_str())
        .state(parts.state.as_str())
        .assets(assets);

    if let (Some(start), Some(end)) = (parts.start, parts.end) {
        activity = activity.timestamps(Timestamps::new().start(start).end(end));
    }

    if with_buttons {
        if let Some(ref url) = parts.button_url {
            activity = activity.buttons(vec![Button::new("Open Wicked Music", url.as_str())]);
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

    match set_activity_with_parts(client, &parts, true) {
        Ok(()) => {
            guard.last_error = None;
            guard.last_payload = Some(payload);
            Ok(())
        }
        Err(e) => match set_activity_with_parts(client, &parts, false) {
            Ok(()) => {
                guard.last_error =
                    Some(format!("Buttons unsupported; presence set without them ({e})"));
                guard.last_payload = Some(payload);
                Ok(())
            }
            Err(e2) => {
                guard.client = None;
                ensure_connected(&mut guard, &payload.client_id)?;
                let client = guard
                    .client
                    .as_mut()
                    .ok_or_else(|| "Discord client not connected".to_string())?;
                let result = set_activity_with_parts(client, &parts, false);
                if let Err(ref err) = result {
                    guard.last_error = Some(err.clone());
                } else {
                    guard.last_error = Some(format!("Reconnected after error: {e2}"));
                    guard.last_payload = Some(payload);
                }
                result
            }
        },
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
