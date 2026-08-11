import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./features/settings/SettingsContext";
import { PlayerProvider } from "./features/player/PlayerContext";
import { FavoritesProvider } from "./features/library/FavoritesContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <SettingsProvider>
        <FavoritesProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </FavoritesProvider>
      </SettingsProvider>
    </HashRouter>
  </React.StrictMode>,
);
