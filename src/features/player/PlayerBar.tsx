import { usePlayer } from "./PlayerContext";
import { Cover } from "../library/Cover";
import { useFavorites } from "../library/FavoritesContext";
import { APP_NAME } from "../../lib/constants";
import { NowPlayingMenu } from "./NowPlayingMenu";
import { SleepTimer } from "./SleepTimer";
import { AutoDj } from "./AutoDj";
import { DevicePicker } from "./DevicePicker";
import {
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconLyrics,
  IconRepeat,
  IconShuffle,
  IconSpeaker,
  IconSpeakerMute,
  IconStar,
  IconStarFilled,
} from "./icons";

export function PlayerBar() {
  const {
    current,
    playing,
    shuffle,
    repeat,
    queuePanelOpen,
    lyricsMode,
    positionMs,
    durationMs,
    volume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    adjustVolume,
    toggleShuffle,
    cycleRepeat,
    toggleQueuePanel,
    cycleLyricsMode,
  } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  const favorite = isFavorite(current?.id);
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const volumePercent = Math.round(volume * 100);
  const subtitle = [current?.artist, current?.album].filter(Boolean).join(" - ");
  const lyricsActive = lyricsMode !== "off";

  return (
    <header className="player-bar am-bar">
      <div className="transport-controls">
        <button
          className={`icon-btn ghost${shuffle ? " active" : ""}`}
          type="button"
          onClick={toggleShuffle}
          aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
          aria-pressed={shuffle}
          title={shuffle ? "Shuffle On" : "Shuffle Off"}
        >
          <IconShuffle size={16} />
        </button>
        <button className="icon-btn ghost" type="button" onClick={prev} aria-label="Previous" title="Previous">
          <IconPrev size={17} />
        </button>
        <button
          className="icon-btn play"
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
          disabled={!current}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <button className="icon-btn ghost" type="button" onClick={next} aria-label="Next" title="Next">
          <IconNext size={17} />
        </button>
        <button
          className={`icon-btn ghost repeat-btn${repeat !== "off" ? " active" : ""}${repeat === "one" ? " repeat-one" : ""}`}
          type="button"
          onClick={cycleRepeat}
          aria-label={
            repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat playlist" : "Repeat song"
          }
          aria-pressed={repeat !== "off"}
          title={
            repeat === "off"
              ? "Repeat Off"
              : repeat === "all"
                ? "Repeat Playlist"
                : "Repeat One Song"
          }
        >
          <IconRepeat size={16} />
          {repeat === "one" && <span className="repeat-one-badge" aria-hidden>1</span>}
        </button>
      </div>

      <div className="now-module">
        <div className="now-module-body">
          {current?.coverUrl ? (
            <Cover src={current.coverUrl} className="now-cover" alt="" />
          ) : (
            <div className="cover-fallback now-cover" />
          )}
          <div className="now-module-text" key={current?.id ?? "idle"}>
            <div className="now-title-row">
              <span className="title">{current?.title ?? APP_NAME}</span>
              <NowPlayingMenu />
            </div>
            <div className="artist">{subtitle || "Nothing playing"}</div>
          </div>
          <button
            type="button"
            className={`icon-btn tiny star${favorite ? " active" : ""}`}
            onClick={() => current && void toggleFavorite(current)}
            disabled={!current}
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from Favorites" : "Add to Favorites"}
            title={favorite ? "Remove from Favorites (F)" : "Add to Favorites (F)"}
          >
            {favorite ? <IconStarFilled size={15} /> : <IconStar size={15} />}
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
        <AutoDj />
        <DevicePicker />
        <SleepTimer />
        <div
          className="volume"
          onWheel={(e) => adjustVolume(e.deltaY < 0 ? 1 : -1)}
          title={`Volume ${volumePercent}%`}
        >
          {volumePercent === 0 ? <IconSpeakerMute size={15} /> : <IconSpeaker size={15} />}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumePercent}
            style={{ ["--fill" as string]: `${volumePercent}%` }}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="Volume"
            aria-valuetext={`${volumePercent} percent`}
          />
          <span className="volume-value">{volumePercent}</span>
        </div>
        <button
          className={`icon-btn ghost lyrics-toggle${lyricsActive ? " active" : ""}`}
          type="button"
          onClick={cycleLyricsMode}
          aria-label={
            lyricsMode === "off"
              ? "Show lyrics"
              : lyricsMode === "side"
                ? "Expand lyrics"
                : "Hide lyrics"
          }
          aria-pressed={lyricsActive}
          title={
            lyricsMode === "off"
              ? "Lyrics (Y)"
              : lyricsMode === "side"
                ? "Full-screen lyrics (Y)"
                : "Close lyrics (Y)"
          }
        >
          <IconLyrics size={17} />
        </button>
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
