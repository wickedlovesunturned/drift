import { useEffect, useState, type FormEvent } from "react";
import { useSettings, type AppSettings } from "./SettingsContext";
import { invoke } from "@tauri-apps/api/core";
import { APP_NAME, SERVER_URL_EXAMPLE } from "../../lib/constants";
import { getLastFmSession } from "../../lib/lastfm";
import { ToggleSwitch } from "./ToggleSwitch";

interface DiscordStatus {
  connected: boolean;
  enabled: boolean;
  lastError?: string | null;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`status-badge${ok ? " ok" : ""}`}>
      <span className="status-dot" aria-hidden />
      {label}
    </span>
  );
}

export function SettingsPage() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState<AppSettings>({ ...settings, lastFmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectingLastFm, setConnectingLastFm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discord, setDiscord] = useState<DiscordStatus | null>(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, ...settings, lastFmPassword: prev.lastFmPassword }));
  }, [settings]);

  useEffect(() => {
    void invoke<DiscordStatus>("discord_status")
      .then(setDiscord)
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save({
        ...form,
        serverUrl: form.serverUrl.trim(),
      });
      setMessage("Settings saved.");
      try {
        const status = await invoke<DiscordStatus>("discord_status");
        setDiscord(status);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onTestDiscord() {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await save({
        ...form,
        serverUrl: form.serverUrl.trim(),
        discordShowListening: true,
      });
      const status = await invoke<DiscordStatus>("discord_test");
      setDiscord(status);
      setMessage(
        status.connected
          ? `Discord connected. Check your Discord profile for a ${APP_NAME} test presence.`
          : "Discord test ran but is not connected.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  async function onConnectLastFm() {
    setConnectingLastFm(true);
    setError(null);
    setMessage(null);
    try {
      const sessionKey = await getLastFmSession(
        form.lastFmApiKey,
        form.lastFmApiSecret,
        form.lastFmUsername,
        form.lastFmPassword,
      );
      const saved = await save({
        ...form,
        serverUrl: form.serverUrl.trim(),
        lastFmSessionKey: sessionKey,
        lastFmScrobbleEnabled: true,
      });
      setForm({ ...saved, lastFmPassword: "" });
      setMessage("Last.fm connected. Scrobbling is enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingLastFm(false);
    }
  }

  const lastFmConnected = Boolean(form.lastFmSessionKey.trim());

  return (
    <div className="settings-page">
      <h1 className="section-title">Settings</h1>
      <p className="section-sub">Server, scrobbling, and integrations.</p>

      <form className="settings-stack" onSubmit={onSubmit}>
        <section className="settings-card">
          <header className="settings-card-head">
            <h2>Navidrome</h2>
            <p className="muted">Your music server connection.</p>
          </header>
          <div className="form">
            <label>
              Server URL
              <input
                type="url"
                required
                placeholder={SERVER_URL_EXAMPLE}
                value={form.serverUrl}
                onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
              />
            </label>
            <label>
              Username
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-head">
            <div className="settings-card-title-row">
              <h2>Discord</h2>
              {discord && (
                <StatusBadge
                  ok={discord.connected}
                  label={discord.connected ? "Connected" : "Not connected"}
                />
              )}
            </div>
            <p className="muted">Rich Presence while you listen.</p>
          </header>

          <ToggleSwitch
            checked={form.discordShowListening}
            onChange={(discordShowListening) => setForm({ ...form, discordShowListening })}
            label="Show what I'm listening to"
            description="Requires Discord desktop. Create an app in the Developer Portal and paste its Client ID below."
          />

          <div className={`settings-fields${form.discordShowListening ? "" : " collapsed"}`}>
            <label>
              Application Client ID
              <input
                type="text"
                placeholder="From Discord Developer Portal"
                value={form.discordClientId}
                onChange={(e) => setForm({ ...form, discordClientId: e.target.value })}
              />
            </label>
            <label>
              Fallback image asset key
              <input
                type="text"
                value={form.discordFallbackImageKey}
                onChange={(e) =>
                  setForm({ ...form, discordFallbackImageKey: e.target.value })
                }
              />
            </label>
            <label>
              Last.fm API key
              <input
                type="text"
                placeholder="Optional — for album art in Discord"
                value={form.lastFmApiKey}
                onChange={(e) => setForm({ ...form, lastFmApiKey: e.target.value })}
              />
            </label>
            <p className="field-hint muted">
              Upload a square image named <code>app_logo</code> under Rich Presence → Art Assets.
              Last.fm keys come from{" "}
              <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
                last.fm/api
              </a>
              .
            </p>
            {discord?.lastError && (
              <p className="error compact">{discord.lastError}</p>
            )}
            <button
              className="btn secondary"
              type="button"
              disabled={testing || !form.discordClientId.trim()}
              onClick={() => void onTestDiscord()}
            >
              {testing ? "Testing…" : "Test Discord"}
            </button>
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-head">
            <div className="settings-card-title-row">
              <h2>Last.fm</h2>
              <StatusBadge
                ok={lastFmConnected}
                label={lastFmConnected ? "Connected" : "Not connected"}
              />
            </div>
            <p className="muted">Scrobble plays to your Last.fm profile.</p>
          </header>

          <ToggleSwitch
            checked={form.lastFmScrobbleEnabled}
            onChange={(lastFmScrobbleEnabled) => setForm({ ...form, lastFmScrobbleEnabled })}
            label="Enable scrobbling"
            description="Sends now playing and scrobbles when you've listened long enough."
            disabled={!lastFmConnected}
          />

          <div className="settings-fields">
            <label>
              API key
              <input
                type="text"
                value={form.lastFmApiKey}
                onChange={(e) => setForm({ ...form, lastFmApiKey: e.target.value })}
              />
            </label>
            <label>
              Shared secret
              <input
                type="password"
                value={form.lastFmApiSecret}
                onChange={(e) => setForm({ ...form, lastFmApiSecret: e.target.value })}
              />
            </label>
            <label>
              Username
              <input
                type="text"
                value={form.lastFmUsername}
                onChange={(e) => setForm({ ...form, lastFmUsername: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder={lastFmConnected ? "Leave blank to keep session" : "Last.fm password"}
                value={form.lastFmPassword}
                onChange={(e) => setForm({ ...form, lastFmPassword: e.target.value })}
              />
            </label>
            <button
              className="btn secondary"
              type="button"
              disabled={
                connectingLastFm ||
                !form.lastFmApiKey.trim() ||
                !form.lastFmApiSecret.trim() ||
                !form.lastFmUsername.trim() ||
                !form.lastFmPassword
              }
              onClick={() => void onConnectLastFm()}
            >
              {connectingLastFm ? "Connecting…" : lastFmConnected ? "Reconnect Last.fm" : "Connect Last.fm"}
            </button>
          </div>
        </section>

        {error && <p className="error">{error}</p>}
        {message && <p className="success-msg">{message}</p>}

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <section className="settings-card shortcuts">
        <h2 className="panel-title">Keyboard shortcuts</h2>
        <dl className="shortcut-list">
          {SHORTCUTS.map(([keys, label]) => (
            <div className="shortcut" key={label}>
              <dt>
                {keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["Space", "K"], "Play / pause"],
  [["←", "→"], "Seek 5 seconds"],
  [["J", "L"], "Seek 10 seconds"],
  [["Ctrl", "←/→"], "Previous / next track"],
  [["N", "P"], "Next / previous track"],
  [["↑", "↓"], "Volume by 5"],
  [["M"], "Mute"],
  [["S"], "Shuffle"],
  [["R"], "Repeat mode"],
  [["F"], "Favorite current song"],
  [["Q"], "Playing Next panel"],
  [["Y"], "Lyrics panel"],
];
