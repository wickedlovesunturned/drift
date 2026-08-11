mod discord;
mod session;
mod settings;

use discord::{DiscordState, DiscordStatus, PresencePayload, SharedDiscord};
use session::PlaybackSession;
use settings::SettingsPayload;
use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn settings_get() -> Result<SettingsPayload, String> {
    settings::get_settings()
}

#[tauri::command]
fn settings_set(
    app: tauri::AppHandle,
    payload: SettingsPayload,
) -> Result<SettingsPayload, String> {
    let saved = settings::set_settings(payload)?;
    if !saved.discord_show_listening {
        let state = app.state::<SharedDiscord>();
        let _ = discord::clear_presence(&state);
    } else if !saved.discord_client_id.trim().is_empty() {
        let state = app.state::<SharedDiscord>();
        let _ = discord::connect_only(&state, &saved.discord_client_id);
    }
    Ok(saved)
}

#[tauri::command]
fn discord_set_presence(app: tauri::AppHandle, payload: PresencePayload) -> Result<(), String> {
    let settings = settings::get_settings()?;
    if !settings.discord_show_listening {
        let state = app.state::<SharedDiscord>();
        return discord::clear_presence(&state);
    }
    let state = app.state::<SharedDiscord>();
    discord::set_presence(&state, payload)
}

#[tauri::command]
fn discord_clear_presence(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<SharedDiscord>();
    discord::clear_presence(&state)
}

#[tauri::command]
fn discord_status(app: tauri::AppHandle) -> Result<DiscordStatus, String> {
    let settings = settings::get_settings()?;
    let state = app.state::<SharedDiscord>();
    Ok(discord::status(&state, settings.discord_show_listening))
}

#[tauri::command]
fn session_get() -> Result<PlaybackSession, String> {
    session::get_session()
}

#[tauri::command]
fn session_set(payload: PlaybackSession) -> Result<PlaybackSession, String> {
    session::set_session(payload)
}

#[tauri::command]
fn discord_test(app: tauri::AppHandle) -> Result<DiscordStatus, String> {
    let settings = settings::get_settings()?;
    if settings.discord_client_id.trim().is_empty() {
        return Err("Set a Discord Application Client ID first.".to_string());
    }
    let state = app.state::<SharedDiscord>();
    discord::connect_only(&state, &settings.discord_client_id)?;
    let payload = PresencePayload {
        title: "Wicked Music".to_string(),
        artist: "Connected".to_string(),
        album: "Test".to_string(),
        position_ms: 0,
        duration_ms: 180_000,
        cover_url: None,
        server_url: settings.server_url,
        client_id: settings.discord_client_id,
        fallback_image_key: settings.discord_fallback_image_key,
        paused: false,
    };
    discord::set_presence(&state, payload)?;
    Ok(discord::status(&state, settings.discord_show_listening))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(DiscordState::new()) as SharedDiscord)
        .invoke_handler(tauri::generate_handler![
            settings_get,
            settings_set,
            session_get,
            session_set,
            discord_set_presence,
            discord_clear_presence,
            discord_status,
            discord_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
