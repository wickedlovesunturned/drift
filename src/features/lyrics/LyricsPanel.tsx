import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";
import {
  fetchTrackLyrics,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const manualScrollUntil = useRef(0);

  useEffect(() => {
    if (!current) {
      setLyrics(null);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchTrackLyrics(
      auth,
      current.artist ?? "",
      current.title ?? "",
      current.album ?? "",
      current.duration,
      current.id,
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

  const displaySynced = useMemo(() => lyrics?.synced ?? [], [lyrics]);

  const activeIdx =
    displaySynced && displaySynced.length > 0
      ? activeLineIndex(displaySynced, positionMs)
      : -1;
  const lyricTime = positionMs;

  useEffect(() => {
    if (!displaySynced || activeIdx < 0) return;
    if (Date.now() < manualScrollUntil.current) return;
    const el = scrollRef.current?.querySelector(`[data-line="${activeIdx}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx, displaySynced]);

  function onScroll() {
    manualScrollUntil.current = Date.now() + 4000;
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
        {!loading && displaySynced.length > 0 && (
          <div className="lyrics-sync">
            {displaySynced.map((line, i) => (
              <button
                key={`${line.timeMs}-${i}`}
                type="button"
                data-line={i}
                className={`lyrics-line${i === activeIdx ? " active" : i < activeIdx ? " past" : ""}`}
                onClick={() => seek(line.timeMs)}
              >
                {line.cues?.length
                  ? line.cues.map((cue, cueIndex, cues) => {
                      const nextCue = cues[cueIndex + 1];
                      const isPast = lyricTime >= (cue.endMs ?? nextCue?.timeMs ?? Number.POSITIVE_INFINITY);
                      const isActive = lyricTime >= cue.timeMs && !isPast;
                      return (
                        <span
                          key={`${cue.timeMs}-${cueIndex}`}
                          className={`lyrics-cue${isPast ? " past" : isActive ? " active" : ""}`}
                        >
                          {cue.text}
                        </span>
                      );
                    })
                  : line.text}
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
          {displaySynced.length
            ? lyrics.synced?.length
              ? "Auto-synced lyrics · click a line to seek"
              : "Lyrics"
            : "Lyrics"}{" "}
          · {lyrics.source === "server" ? "Navidrome" : "LRCLIB"}
          {playing ? "" : " · paused"}
          {fullscreen ? " · press Y to close" : " · press Y again for full screen"}
        </footer>
      )}
    </div>
  );
}
