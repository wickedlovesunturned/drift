use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const SERVICE: &str = "wicked-music";
const CREDENTIAL_USER: &str = "wicked-music-credentials";
const DEFAULT_SERVER_URL: &str = "http://navidrome.tail861ba5.ts.net:4533";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub server_url: String,
    pub username: String,
    pub discord_client_id: String,
    pub discord_show_listening: bool,
    pub discord_fallback_image_key: String,
    #[serde(default)]
    pub last_fm_api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPayload {
    pub server_url: String,
    pub username: String,
    pub password: String,
    pub discord_client_id: String,
    pub discord_show_listening: bool,
    pub discord_fallback_image_key: String,
    #[serde(default)]
    pub last_fm_api_key: String,
}

fn config_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Could not resolve config directory".to_string())?
        .join("wicked-music");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

fn load_file_settings() -> Result<AppSettings, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(AppSettings {
            server_url: DEFAULT_SERVER_URL.to_string(),
            discord_fallback_image_key: "app_logo".to_string(),
            ..Default::default()
        });
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut settings: AppSettings = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if settings.server_url.trim().is_empty() {
        settings.server_url = DEFAULT_SERVER_URL.to_string();
    }
    if settings.discord_fallback_image_key.is_empty() {
        settings.discord_fallback_image_key = "app_logo".to_string();
    }
    Ok(settings)
}

fn save_file_settings(settings: &AppSettings) -> Result<(), String> {
    let path = config_path()?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn save_password(password: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, CREDENTIAL_USER).map_err(|e| e.to_string())?;
    if password.is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry.set_password(password).map_err(|e| e.to_string())
}

fn load_password() -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE, CREDENTIAL_USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(p),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_settings() -> Result<SettingsPayload, String> {
    let file = load_file_settings()?;
    let password = load_password().unwrap_or_default();
    Ok(SettingsPayload {
        server_url: file.server_url,
        username: file.username,
        password,
        discord_client_id: file.discord_client_id,
        discord_show_listening: file.discord_show_listening,
        discord_fallback_image_key: file.discord_fallback_image_key,
        last_fm_api_key: file.last_fm_api_key,
    })
}

pub fn set_settings(payload: SettingsPayload) -> Result<SettingsPayload, String> {
    let server_url = {
        let trimmed = payload.server_url.trim().trim_end_matches('/').to_string();
        if trimmed.is_empty() {
            DEFAULT_SERVER_URL.to_string()
        } else {
            trimmed
        }
    };
    let settings = AppSettings {
        server_url,
        username: payload.username.clone(),
        discord_client_id: payload.discord_client_id.trim().to_string(),
        discord_show_listening: payload.discord_show_listening,
        discord_fallback_image_key: if payload.discord_fallback_image_key.trim().is_empty() {
            "app_logo".to_string()
        } else {
            payload.discord_fallback_image_key.trim().to_string()
        },
        last_fm_api_key: payload.last_fm_api_key.trim().to_string(),
    };
    save_file_settings(&settings)?;
    save_password(&payload.password)?;
    get_settings()
}
