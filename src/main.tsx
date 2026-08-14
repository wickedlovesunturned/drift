import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./features/settings/SettingsContext";
import { PlayerProvider } from "./features/player/PlayerContext";
import { FavoritesProvider } from "./features/library/FavoritesContext";
import { UpdaterProvider } from "./features/updates/UpdaterContext";
import "./styles.css";

// Desktop app — block the browser/WebView default context menu.
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <UpdaterProvider>
        <SettingsProvider>
          <FavoritesProvider>
            <PlayerProvider>
              <App />
            </PlayerProvider>
          </FavoritesProvider>
        </SettingsProvider>
      </UpdaterProvider>
    </HashRouter>
  </React.StrictMode>,
);
