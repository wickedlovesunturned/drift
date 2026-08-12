use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionTrack {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub album_id: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub artist_id: Option<String>,
    #[serde(default)]
    pub cover_art: Option<String>,
    #[serde(default)]
    pub track: Option<u32>,
    #[serde(default)]
    pub duration: Option<u32>,
    #[serde(default)]
    pub year: Option<u32>,
    #[serde(default)]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSource {
    /// playlist | album | search | queue
    pub kind: String,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSession {
    #[serde(default)]
    pub queue: Vec<SessionTrack>,
    #[serde(default)]
    pub current_index: i32,
    #[serde(default)]
    pub position_ms: f64,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub shuffle: bool,
    #[serde(default = "default_repeat")]
    pub repeat: String,
    #[serde(default)]
    pub queue_panel_open: bool,
    #[serde(default)]
    pub was_playing: bool,
    #[serde(default)]
    pub source: Option<PlaybackSource>,
    #[serde(default)]
    pub last_path: String,
}

fn default_volume() -> f64 {
    0.85
}

fn default_repeat() -> String {
    "off".to_string()
}

impl Default for PlaybackSession {
    fn default() -> Self {
        Self {
            queue: Vec::new(),
            current_index: -1,
            position_ms: 0.0,
            volume: default_volume(),
            shuffle: false,
            repeat: default_repeat(),
            queue_panel_open: false,
            was_playing: false,
            source: None,
            last_path: String::new(),
        }
    }
}

fn session_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Could not resolve config directory".to_string())?
        .join("drift");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("session.json"))
}

pub fn get_session() -> Result<PlaybackSession, String> {
    let path = session_path()?;
    if !path.exists() {
        return Ok(PlaybackSession::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut session: PlaybackSession = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if session.volume.is_nan() || session.volume < 0.0 {
        session.volume = 0.0;
    } else if session.volume > 1.0 {
        session.volume = 1.0;
    }
    if session.position_ms.is_nan() || session.position_ms < 0.0 {
        session.position_ms = 0.0;
    }
    if !matches!(session.repeat.as_str(), "off" | "all" | "one") {
        session.repeat = "off".to_string();
    }
    if session.current_index < -1 {
        session.current_index = -1;
    }
    if session.queue.is_empty() {
        session.current_index = -1;
        session.position_ms = 0.0;
        session.was_playing = false;
    } else if session.current_index >= session.queue.len() as i32 {
        session.current_index = (session.queue.len() as i32) - 1;
    }
    Ok(session)
}

pub fn set_session(session: PlaybackSession) -> Result<PlaybackSession, String> {
    let path = session_path()?;
    let raw = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())?;
    Ok(session)
}
