import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";
import {
  fetchTrackLyrics,
  loadLyricsOffset,
  saveLyricsOffset,
  type TrackLyrics,
} from "../../lib/lyrics";
import { activeLineIndex } from "../../lib/lrc";
import { Cover } from "../library/Cover";

interface LyricsPanelProps {
  compact?: boolean;
  fullscreen?: boolean;
  onClose?: () => void;
}

export function LyricsPanel({ compact, fullscreen, onClose }: LyricsPanelProps) {
  const { auth } = useSettings();
  const { current, playing, positionMs, seek } = usePlayer();
  const [lyrics, setLyrics] = useState<TrackLyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const manualScrollUntil = useRef(0);

  useEffect(() => {
    if (!current) {
      setLyrics(null);
      return;
    }
    setOffsetMs(loadLyricsOffset(current.id));
    let active = true;
    setLoading(true);
    void fetchTrackLyrics(
      auth,
      current.artist ?? "",
      current.title ?? "",
      current.album ?? "",
      current.duration,
    )
      .then((result) => {
        if (active) setLyrics(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth, current?.id, current?.artist, current?.title, current?.album, current?.duration]);

  const activeIdx =
    lyrics?.synced && lyrics.synced.length > 0
      ? activeLineIndex(lyrics.synced, positionMs, offsetMs)
      : -1;

  useEffect(() => {
    if (!lyrics?.synced || activeIdx < 0) return;
    if (Date.now() < manualScrollUntil.current) return;
    const el = scrollRef.current?.querySelector(`[data-line="${activeIdx}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx, lyrics?.synced]);

  function onScroll() {
    manualScrollUntil.current = Date.now() + 4000;
  }

  function adjustOffset(delta: number) {
    if (!current) return;
    const next = offsetMs + delta;
    setOffsetMs(next);
    saveLyricsOffset(current.id, next);
  }

  if (!current) {
    return (
      <div className={`lyrics-panel empty${fullscreen ? " fullscreen" : ""}${compact ? " compact" : ""}`}>
        <p className="muted">Play a song to see lyrics here.</p>
      </div>
    );
  }

  return (
    <div className={`lyrics-panel${fullscreen ? " fullscreen" : ""}${compact ? " compact" : ""}`}>
      <header className="lyrics-header">
        <div className="lyrics-track">
          {current.coverUrl ? (
            <Cover src={current.coverUrl} className="lyrics-cover" alt="" />
          ) : (
            <div className="cover-fallback lyrics-cover" />
          )}
          <div>
            <h2 className="lyrics-title">{current.title}</h2>
            <p className="lyrics-artist muted">
              {current.artistId ? (
                <Link to={`/artist/${current.artistId}`}>{current.artist}</Link>
              ) : (
                current.artist
              )}
              {current.album ? ` · ${current.album}` : ""}
            </p>
          </div>
        </div>
        <div className="lyrics-header-actions">
          {lyrics?.synced && (
            <div className="lyrics-offset">
              <button type="button" className="btn tiny secondary" onClick={() => adjustOffset(-500)}>
                −0.5s
              </button>
              <span className="muted">Sync</span>
              <button type="button" className="btn tiny secondary" onClick={() => adjustOffset(500)}>
                +0.5s
              </button>
            </div>
          )}
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close lyrics" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="lyrics-body" ref={scrollRef} onScroll={onScroll}>
        {loading && <p className="muted lyrics-status">Loading lyrics…</p>}
        {!loading && !lyrics && (
          <p className="muted lyrics-status">No lyrics found for this track.</p>
        )}
        {!loading && lyrics?.synced && lyrics.synced.length > 0 && (
          <div className="lyrics-sync">
            {lyrics.synced.map((line, i) => (
              <button
                key={`${line.timeMs}-${i}`}
                type="button"
                data-line={i}
                className={`lyrics-line${i === activeIdx ? " active" : i < activeIdx ? " past" : ""}`}
                onClick={() => seek(line.timeMs - offsetMs)}
              >
                {line.text}
              </button>
            ))}
          </div>
        )}
        {!loading && lyrics && !lyrics.synced?.length && lyrics.plain && (
          <div className="lyrics-plain">
            {lyrics.plain.map((line, i) => (
              <p key={i} className="lyrics-line plain">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      {lyrics && (
        <footer className="lyrics-footer muted">
          {lyrics.synced?.length
            ? "Synchronized · click a line to seek"
            : "Lyrics"}{" "}
          · {lyrics.source === "server" ? "Navidrome" : "LRCLIB"}
          {playing ? "" : " · paused"}
          {fullscreen ? " · press Y to close" : " · press Y again for full screen"}
        </footer>
      )}
    </div>
  );
}
