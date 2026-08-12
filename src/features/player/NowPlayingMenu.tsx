import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "./PlayerContext";
import { useFavorites } from "../library/FavoritesContext";
import { IconMore } from "./icons";

export function NowPlayingMenu() {
  const navigate = useNavigate();
  const { current, cycleLyricsMode, removeCurrentFromQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!current) {
    return (
      <button type="button" className="icon-btn tiny" disabled aria-label="More" title="More">
        <IconMore size={14} />
      </button>
    );
  }

  const favorite = isFavorite(current.id);

  return (
    <div className="now-menu" ref={rootRef}>
      <button
        type="button"
        className={`icon-btn tiny${open ? " active" : ""}`}
        aria-label="More"
        aria-expanded={open}
        title="More"
        onClick={() => setOpen((v) => !v)}
      >
        <IconMore size={14} />
      </button>
      {open && (
        <div className="now-menu-dropdown" role="menu">
          {current.albumId && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(`/album/${current.albumId}`);
              }}
            >
              Go to album
            </button>
          )}
          {(current.artistId || current.artist) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (current.artistId) navigate(`/artist/${current.artistId}`);
                else navigate(`/search?q=${encodeURIComponent(current.artist ?? "")}`);
              }}
            >
              Go to artist
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              cycleLyricsMode();
            }}
          >
            View lyrics
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void toggleFavorite(current);
              setOpen(false);
            }}
          >
            {favorite ? "Remove from Favorites" : "Add to Favorites"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const text = [current.title, current.artist].filter(Boolean).join(" — ");
              void navigator.clipboard?.writeText(text);
              setOpen(false);
            }}
          >
            Copy song name
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              removeCurrentFromQueue();
              setOpen(false);
            }}
          >
            Remove from queue
          </button>
        </div>
      )}
    </div>
  );
}
