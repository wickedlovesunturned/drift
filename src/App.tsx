import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useSettings } from "./features/settings/SettingsContext";
import { usePlayer } from "./features/player/PlayerContext";
import { AppShell } from "./features/layout/AppShell";
import { TitleBar } from "./features/layout/TitleBar";
import { ConnectPage } from "./features/auth/ConnectPage";
import { HomePage } from "./features/library/HomePage";
import { AlbumPage } from "./features/library/AlbumPage";
import { LibraryPage } from "./features/library/LibraryPage";
import { FavoritesPage } from "./features/library/FavoritesPage";
import { PlaylistsPage } from "./features/library/PlaylistsPage";
import { PlaylistPage } from "./features/library/PlaylistPage";
import { SearchPage } from "./features/library/SearchPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useDiscordPresence } from "./features/discord/useDiscordPresence";
import { APP_NAME } from "./lib/constants";

function SessionRouteSync() {
  const { sessionReady, lastPath, setLastPath } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();
  const bootstrapping = useRef(true);

  useEffect(() => {
    if (!sessionReady) return;
    const current = `${location.pathname}${location.search}`;

    if (bootstrapping.current) {
      bootstrapping.current = false;
      if (lastPath && lastPath !== current && !lastPath.startsWith("/settings")) {
        navigate(lastPath, { replace: true });
        return;
      }
    }

    setLastPath(current);
  }, [sessionReady, lastPath, location.pathname, location.search, navigate, setLastPath]);

  return null;
}

export default function App() {
  const { loading, configured } = useSettings();
  useDiscordPresence();

  return (
    <div className="app-root">
      <TitleBar showNav={!loading && configured} />
      {loading ? (
        <div className="boot">
          <img className="brand-mark boot-mark" src="/logo.png" alt="" />
          <p className="boot-brand">{APP_NAME}</p>
          <p className="muted">Loading…</p>
        </div>
      ) : !configured ? (
        <ConnectPage />
      ) : (
        <>
          <SessionRouteSync />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="album/:id" element={<AlbumPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlist/:id" element={<PlaylistPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      )}
    </div>
  );
}
