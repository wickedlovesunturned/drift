import { usePlayer } from "./PlayerContext";
import { formatDuration } from "../../lib/subsonic/client";
import { Cover } from "../library/Cover";

function formatMs(ms: number): string {
  return formatDuration(Math.floor(ms / 1000));
}

export function PlayerBar() {
  const {
    current,
    playing,
    shuffle,
    queuePanelOpen,
    positionMs,
    durationMs,
    volume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    toggleQueuePanel,
  } = usePlayer();

  return (
    <footer className="player-bar">
      <div className="now-playing">
        {current?.coverUrl ? (
          <Cover src={current.coverUrl} className="now-cover" alt="" />
        ) : (
          <div className="cover-fallback now-cover" />
        )}
        <div className="text">
          <div className="title">{current?.title ?? "Nothing playing"}</div>
          <div className="artist">{current?.artist ?? "Select a track to start"}</div>
        </div>
      </div>

      <div className="transport">
        <div className="transport-controls">
          <button
            className={`icon-btn${shuffle ? " active" : ""}`}
            type="button"
            onClick={toggleShuffle}
            aria-label="Shuffle"
            title="Shuffle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button className="icon-btn" type="button" onClick={prev} aria-label="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
            </svg>
          </button>
          <button
            className="icon-btn primary"
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            disabled={!current}
          >
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            )}
          </button>
          <button className="icon-btn" type="button" onClick={next} aria-label="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
            </svg>
          </button>
        </div>
        <div className="seek">
          <span>{formatMs(positionMs)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(durationMs, 1)}
            value={Math.min(positionMs, durationMs || 0)}
            disabled={!current}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span>{formatMs(durationMs)}</span>
        </div>
      </div>

      <div className="player-utils">
        <div className="volume">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a3.5 3.5 0 00-1.8-3.1v6.2A3.5 3.5 0 0016.5 12z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
        <button
          className={`icon-btn queue-toggle${queuePanelOpen ? " active" : ""}`}
          type="button"
          onClick={toggleQueuePanel}
          aria-label={queuePanelOpen ? "Hide Playing Next" : "Show Playing Next"}
          aria-pressed={queuePanelOpen}
          title="Playing Next"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
