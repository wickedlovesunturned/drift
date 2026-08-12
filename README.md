# drift

A desktop client for [Navidrome](https://www.navidrome.org/) with a Spotify / Apple Music style
interface and optional **Discord Rich Presence**. Built with [Tauri 2](https://tauri.app/),
React, and TypeScript; talks to your server over the Subsonic API.

drift ships with no server baked in — you point it at your own Navidrome instance on first launch.

## Features

- Connect to any Navidrome (or Subsonic-compatible) server
- Browse Home, Albums, Favorites, and Playlists, with search across the library
- Play, pause, seek, shuffle, repeat, and a resizable "Playing Next" queue
- Favorites synced to the server
- Media key support and a volume overlay
- Playback session and last view restored on relaunch
- Discord Rich Presence showing what you are listening to
- Custom frameless window with back/forward history navigation

## Prerequisites

- Node.js 20+
- Rust stable, via [rustup](https://rustup.rs/)
- Windows: Visual Studio Build Tools with "Desktop development with C++", plus WebView2
  (preinstalled on Windows 10/11)
- macOS: Xcode Command Line Tools
- Linux: the [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your distro
- A Navidrome server and user account
- Discord desktop app, if you want Rich Presence

## Getting started

```bash
git clone https://github.com/wickedlovesunturned/drift drift
cd drift
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

Installers and binaries land in `src-tauri/target/release/bundle/`.

On first launch drift asks for your server URL (for example `https://music.example.com`),
username, and password.

## Where your data lives

| What | Where |
|------|-------|
| Server URL, username, Discord and Last.fm settings | `settings.json` in your OS config directory under `drift/` |
| Password | OS keyring (Windows Credential Manager, macOS Keychain, Secret Service on Linux) |
| Playback session and last view | `session.json` alongside `settings.json` |

On Windows that config directory is `%APPDATA%\drift`.

## Discord Rich Presence

Presence is off until you enable it, and it needs your own Discord application so the art assets
belong to you.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create a
   **New Application**.
2. Copy the **Application ID** into Settings, under Discord Application Client ID.
3. Open **Rich Presence -> Art Assets** and upload a square image named `app_logo` (or whatever you
   set as the fallback key).
4. Enable **Show what I am listening to on Discord** and keep Discord running.

When a track is playing, drift publishes:

| Field | Value |
|-------|-------|
| Details | Track title |
| State | `Artist - Album` |
| Large image | Public album art when Discord can fetch it, otherwise your fallback asset |
| Timestamps | Start and end derived from playback position and duration |
| Button | `Open drift`, linking to your configured server URL |

Presence clears on pause, on stop, and when the setting is turned off.

Discord fetches cover art from its own servers, so artwork only appears if your Navidrome URL is
reachable from the public internet over HTTPS. Otherwise drift falls back to your uploaded asset, or
to a Last.fm cover if you supply a [Last.fm API key](https://www.last.fm/api/account/create) in
Settings.

## Keyboard shortcuts

| Keys | Action |
|------|--------|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek 5 seconds |
| `J` / `L` | Seek 10 seconds |
| `Ctrl` + `←` / `→`, or `P` / `N` | Previous / next track |
| `↑` / `↓` | Volume by 5 |
| `M` | Mute |
| `S` | Shuffle |
| `R` | Repeat mode |
| `F` | Favorite current song |
| `Q` | Toggle Playing Next panel |

## Project layout

```
src/                    React UI
  features/auth/        First-run connect screen
  features/layout/      App shell, title bar, navigation
  features/library/     Home, albums, playlists, search, favorites
  features/player/      Playback engine, player bar, queue
  features/settings/    Settings screen and persistence
  lib/subsonic/         Subsonic API client
src-tauri/              Tauri/Rust backend (settings, keyring, session, Discord IPC)
app-icon-src/           Icon source art and the script that regenerates the icon set
```

## Contributing

Issues and pull requests are welcome. Please run `npm run build` (typecheck plus bundle) and
`cargo check` inside `src-tauri/` before opening a PR.

## License

[MIT](LICENSE)
