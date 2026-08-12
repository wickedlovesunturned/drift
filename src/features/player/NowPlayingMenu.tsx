import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "./PlayerContext";
import { useFavorites } from "../library/FavoritesContext";
import { IconMore } from "./icons";

type MenuPos =
  | { mode: "up"; bottom: number; left: number; minWidth: number }
  | { mode: "down"; top: number; left: number; minWidth: number };

export function NowPlayingMenu() {
  const navigate = useNavigate();
  const { current, cycleLyricsMode, removeCurrentFromQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      return;
    }
    function place() {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const minWidth = 190;
      const gap = 8;
      const estimatedHeight = menuRef.current?.offsetHeight || 280;
      const openUp = r.top >= estimatedHeight + gap;
      const left = Math.min(
        Math.max(8, r.right - minWidth),
        window.innerWidth - minWidth - 8,
      );
      if (openUp) {
        setPos({
          mode: "up",
          bottom: window.innerHeight - r.top + gap,
          left,
          minWidth,
        });
      } else {
        setPos({
          mode: "down",
          top: r.bottom + gap,
          left,
          minWidth,
        });
      }
    }
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const menuStyle = pos
    ? pos.mode === "up"
      ? {
          bottom: pos.bottom,
          left: pos.left,
          minWidth: pos.minWidth,
          transformOrigin: "bottom right",
        }
      : {
          top: pos.top,
          left: pos.left,
          minWidth: pos.minWidth,
          transformOrigin: "top right",
        }
    : { visibility: "hidden" as const, top: 0, left: 0 };

  const menu = open
    ? createPortal(
        <div
          className="now-menu-dropdown now-menu-portal"
          role="menu"
          ref={menuRef}
          style={menuStyle}
        >
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
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="now-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn tiny${open ? " active" : ""}`}
        aria-label="More"
        aria-expanded={open}
        title="More"
        onClick={() => setOpen((v) => !v)}
      >
        <IconMore size={14} />
      </button>
      {menu}
    </div>
  );
}
