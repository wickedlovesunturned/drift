import { usePlayer } from "./PlayerContext";
import { Cover } from "../library/Cover";
import {
  IconMore,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSpeaker,
  IconStar,
} from "./icons";

export function PlayerBar() {
  const {
    current,
    playing,
    shuffle,
    repeat,
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
    cycleRepeat,
    toggleQueuePanel,
  } = usePlayer();

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const subtitle = [current?.artist, current?.album].filter(Boolean).join(" - ");

  return (
    <header className="player-bar am-bar">
      <div className="transport-controls">
        <button
          className={`icon-btn ghost${shuffle ? " active" : ""}`}
          type="button"
          onClick={toggleShuffle}
          aria-label="Shuffle"
          title="Shuffle"
        >
          <IconShuffle size={16} />
        </button>
        <button className="icon-btn ghost" type="button" onClick={prev} aria-label="Previous">
          <IconPrev size={17} />
        </button>
        <button
          className="icon-btn play"
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          disabled={!current}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <button className="icon-btn ghost" type="button" onClick={next} aria-label="Next">
          <IconNext size={17} />
        </button>
        <button
          className={`icon-btn ghost${repeat !== "off" ? " active" : ""}`}
          type="button"
          onClick={cycleRepeat}
          aria-label={`Repeat ${repeat}`}
          title={repeat === "off" ? "Repeat Off" : repeat === "all" ? "Repeat All" : "Repeat One"}
        >
          {repeat === "one" ? <IconRepeatOne size={16} /> : <IconRepeat size={16} />}
        </button>
      </div>

      <div className="now-module">
        <div className="now-module-body">
          {current?.coverUrl ? (
            <Cover src={current.coverUrl} className="now-cover" alt="" />
          ) : (
            <div className="cover-fallback now-cover" />
          )}
          <div className="now-module-text">
            <div className="now-title-row">
              <span className="title">{current?.title ?? "Wicked Music"}</span>
              <button type="button" className="icon-btn tiny" aria-label="More" title="More">
                <IconMore size={14} />
              </button>
            </div>
            <div className="artist">{subtitle || "Nothing playing"}</div>
          </div>
          <button type="button" className="icon-btn tiny star" aria-label="Favorite" title="Favorite">
            <IconStar size={15} />
          </button>
        </div>
        <div className="now-progress">
          <input
            type="range"
            className="progress-range"
            min={0}
            max={Math.max(durationMs, 1)}
            value={Math.min(positionMs, durationMs || 0)}
            disabled={!current}
            style={{ ["--progress" as string]: `${progress * 100}%` }}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
        </div>
      </div>

      <div className="player-utils">
        <div className="volume">
          <IconSpeaker size={15} />
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
          className={`icon-btn ghost queue-toggle${queuePanelOpen ? " active" : ""}`}
          type="button"
          onClick={toggleQueuePanel}
          aria-label={queuePanelOpen ? "Hide Playing Next" : "Show Playing Next"}
          aria-pressed={queuePanelOpen}
          title="Playing Next"
        >
          <IconQueue size={17} />
        </button>
      </div>
    </header>
  );
}
