mod discord;
mod settings;

use discord::{DiscordState, DiscordStatus, PresencePayload, SharedDiscord};
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
    }
    Ok(saved)
}

#[tauri::command]
fn discord_set_presence(
    app: tauri::AppHandle,
    payload: PresencePayload,
) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(DiscordState::new()) as SharedDiscord)
        .invoke_handler(tauri::generate_handler![
            settings_get,
            settings_set,
            discord_set_presence,
            discord_clear_presence,
            discord_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
