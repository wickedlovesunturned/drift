import { useEffect, useState, type FormEvent } from "react";
import { useSettings, type AppSettings } from "./SettingsContext";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SERVER_URL } from "../../lib/constants";

interface DiscordStatus {
  connected: boolean;
  enabled: boolean;
  lastError?: string | null;
}

export function SettingsPage() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discord, setDiscord] = useState<DiscordStatus | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save({
        ...form,
        serverUrl: form.serverUrl.trim() || DEFAULT_SERVER_URL,
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

  return (
    <div>
      <h1 className="section-title">Settings</h1>
      <p className="section-sub">Server connection and Discord Rich Presence.</p>
      <div className="panel">
        <form className="form" onSubmit={onSubmit}>
          <label>
            Server URL
            <input
              type="url"
              required
              placeholder={DEFAULT_SERVER_URL}
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

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "0.25rem 0" }} />

          <label className="toggle-row">
            <span>
              <strong>Show what I’m listening to on Discord</strong>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                Uses Discord’s local RPC while a track is playing.
              </div>
            </span>
            <input
              type="checkbox"
              checked={form.discordShowListening}
              onChange={(e) =>
                setForm({ ...form, discordShowListening: e.target.checked })
              }
            />
          </label>

          <label>
            Discord Application Client ID
            <input
              type="text"
              placeholder="Application ID from Discord Developer Portal"
              value={form.discordClientId}
              onChange={(e) => setForm({ ...form, discordClientId: e.target.value })}
            />
          </label>

          <label>
            Fallback large image asset key
            <input
              type="text"
              value={form.discordFallbackImageKey}
              onChange={(e) =>
                setForm({ ...form, discordFallbackImageKey: e.target.value })
              }
            />
          </label>

          {discord && (
            <p className="muted" style={{ margin: 0 }}>
              Discord: {discord.connected ? "connected" : "not connected"}
              {discord.lastError ? ` - ${discord.lastError}` : ""}
            </p>
          )}

          {error && <p className="error">{error}</p>}
          {message && <p className="muted">{message}</p>}

          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
