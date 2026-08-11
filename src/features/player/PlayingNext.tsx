import { usePlayer } from "./PlayerContext";
import { Cover } from "../library/Cover";
import { formatDuration } from "../../lib/subsonic/client";

export function PlayingNext() {
  const { upcoming, currentIndex, playQueueIndex, queue, source, toggleQueuePanel } = usePlayer();
  const sourceLabel =
    source?.name ||
    (source?.kind === "playlist"
      ? "Playlist"
      : source?.kind === "album"
        ? "Album"
        : source?.kind === "search"
          ? "Search"
          : null);

  return (
    <aside className="playing-next">
      <div className="playing-next-header">
        <div>
          <h2>Playing Next</h2>
          {sourceLabel && <p className="playing-next-source">{sourceLabel}</p>}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={toggleQueuePanel}
          aria-label="Hide Playing Next"
          title="Hide"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {upcoming.length === 0 ? (
        <p className="muted empty-next">Nothing queued after this track.</p>
      ) : (
        <ul className="playing-next-list">
          {upcoming.map((track, i) => {
            const absoluteIndex = currentIndex + 1 + i;
            return (
              <li key={`${track.id}-${absoluteIndex}`}>
                <button
                  type="button"
                  className="playing-next-row"
                  onClick={() => playQueueIndex(absoluteIndex)}
                >
                  <Cover src={track.coverUrl} className="next-cover" alt="" />
                  <span className="next-meta">
                    <span className="title">{track.title}</span>
                    <span className="artist">{track.artist ?? "Unknown"}</span>
                  </span>
                  <span className="dur">{formatDuration(track.duration)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {queue.length > 0 && (
        <p className="muted queue-count">
          {upcoming.length} upcoming / {queue.length} in queue
        </p>
      )}
    </aside>
  );
}
