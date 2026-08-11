import { useEffect, useState, type FormEvent } from "react";
import { useSettings, type AppSettings } from "../settings/SettingsContext";
import { ping } from "../../lib/subsonic/client";
import { APP_NAME, DEFAULT_SERVER_URL } from "../../lib/constants";

export function ConnectPage() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    serverUrl: settings.serverUrl || DEFAULT_SERVER_URL,
    discordFallbackImageKey: settings.discordFallbackImageKey || "app_logo",
    lastFmApiKey: settings.lastFmApiKey || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...settings,
      serverUrl: settings.serverUrl || DEFAULT_SERVER_URL,
    }));
  }, [settings]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const serverUrl = (form.serverUrl || DEFAULT_SERVER_URL).trim().replace(/\/+$/, "");
      await ping({
        serverUrl,
        username: form.username.trim(),
        password: form.password,
      });
      await save({
        ...form,
        serverUrl,
        username: form.username.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connect-page">
      <div>
        <img className="brand-mark connect-mark" src="/logo.png" alt="" />
        <h1 className="brand">{APP_NAME}</h1>
        <p className="tagline">Your music, from your server.</p>
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
                autoFocus
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
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
