import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AuthConfig } from "../../lib/subsonic/client";

export interface AppSettings {
  serverUrl: string;
  username: string;
  password: string;
  discordClientId: string;
  discordShowListening: boolean;
  discordFallbackImageKey: string;
  lastFmApiKey: string;
  lastFmApiSecret: string;
  lastFmUsername: string;
  lastFmPassword: string;
  lastFmSessionKey: string;
  lastFmScrobbleEnabled: boolean;
}

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  configured: boolean;
  auth: AuthConfig | null;
  refresh: () => Promise<void>;
  save: (next: AppSettings) => Promise<AppSettings>;
}

const defaultSettings: AppSettings = {
  serverUrl: "",
  username: "",
  password: "",
  discordClientId: "",
  discordShowListening: false,
  discordFallbackImageKey: "app_logo",
  lastFmApiKey: "",
  lastFmApiSecret: "",
  lastFmUsername: "",
  lastFmPassword: "",
  lastFmSessionKey: "",
  lastFmScrobbleEnabled: false,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const loaded = await invoke<AppSettings>("settings_get");
      setSettings({
        ...defaultSettings,
        ...loaded,
        serverUrl: loaded.serverUrl?.trim() ?? "",
      });
    } catch {
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: AppSettings) => {
    const saved = await invoke<AppSettings>("settings_set", { payload: next });
    setSettings({ ...defaultSettings, ...saved });
    return saved;
  }, []);

  const configured = Boolean(
    settings.serverUrl && settings.username && settings.password,
  );

  const auth = useMemo<AuthConfig | null>(() => {
    if (!configured) return null;
    return {
      serverUrl: settings.serverUrl,
      username: settings.username,
      password: settings.password,
    };
  }, [configured, settings.serverUrl, settings.username, settings.password]);

  const value = useMemo(
    () => ({ settings, loading, configured, auth, refresh, save }),
    [settings, loading, configured, auth, refresh, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
