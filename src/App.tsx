import { Navigate, Route, Routes } from "react-router-dom";
import { useSettings } from "./features/settings/SettingsContext";
import { AppShell } from "./features/layout/AppShell";
import { ConnectPage } from "./features/auth/ConnectPage";
import { HomePage } from "./features/library/HomePage";
import { AlbumPage } from "./features/library/AlbumPage";
import { LibraryPage } from "./features/library/LibraryPage";
import { PlaylistsPage } from "./features/library/PlaylistsPage";
import { PlaylistPage } from "./features/library/PlaylistPage";
import { SearchPage } from "./features/library/SearchPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useDiscordPresence } from "./features/discord/useDiscordPresence";
import { APP_NAME } from "./lib/constants";

export default function App() {
  const { loading, configured } = useSettings();
  useDiscordPresence();

  if (loading) {
    return (
      <div className="boot">
        <p className="boot-brand">{APP_NAME}</p>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!configured) {
    return <ConnectPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="album/:id" element={<AlbumPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
