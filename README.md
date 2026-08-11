# Wicked Music

Windows desktop client for [Navidrome](https://www.navidrome.org/) with a Spotify / Apple Music–style UI and **Discord Rich Presence** over Discord’s local RPC/IPC.

Default server: `http://navidrome.tail861ba5.ts.net:4533`

## Features (MVP)

- Connect to your Navidrome server (Subsonic API)
- Browse Home, Library, and Playlists
- Play / pause / seek / queue with album art
- Settings:
  - Server URL, username, password (password stored in the OS keyring)
  - **Show what I’m listening to on Discord**
  - Discord Application Client ID
  - Fallback Rich Presence image asset key (default: `app_logo`)

### Discord presence fields

When the toggle is on and a track is playing:

| Field | Value |
|-------|--------|
| Details | Track title |
| State | `Artist — Album` |
| Large image | Public HTTPS album art when Discord can fetch it; otherwise your portal asset |
| Timestamps | Start/end from playback position and duration |
| Button | `Open Wicked Music` → configured server URL (visible to others) |

Presence clears on pause, stop, or when the setting is disabled.

## Prerequisites

- Node.js 20+
- Rust stable (`rustup`)
- Windows: Visual Studio Build Tools with “Desktop development with C++”
- WebView2 (usually preinstalled on Windows 10/11)
- Discord desktop app (for Rich Presence)
- A Navidrome server URL and user account

## Setup

```bash
cd navidrome-desktop
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

## Discord Developer Portal

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Copy the **Application ID** into Settings → Discord Application Client ID.
3. Open **Rich Presence → Art Assets**.
4. Upload a square image (e.g. app logo) and name it `app_logo` (or match whatever you set as the fallback key).
5. Enable **Show what I’m listening to on Discord**.
6. Keep Discord running locally while you listen.

### Album art notes

Discord fetches external image URLs from its servers. If your Navidrome URL is `http://`, on a LAN IP, or otherwise unreachable from the public internet, the app uses the portal fallback asset instead.

## Project layout

```
src/                 React UI + Subsonic client
src-tauri/           Tauri/Rust (settings, Discord IPC)
```
