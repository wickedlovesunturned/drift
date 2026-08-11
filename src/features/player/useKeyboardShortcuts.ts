import { useEffect } from "react";
import { usePlayer } from "./PlayerContext";

const SEEK_SMALL_MS = 5000;
const SEEK_LARGE_MS = 10000;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Player keybinds, modelled on the usual desktop music player set. */
export function useKeyboardShortcuts(onToggleFavorite?: () => void) {
  const {
    toggle,
    next,
    prev,
    seekBy,
    adjustVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueuePanel,
  } = usePlayer();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.metaKey || isTypingTarget(e.target)) return;

      // Ctrl is only used for the track skip pair; anything else falls through
      // so browser/system shortcuts keep working.
      if (e.ctrlKey) {
        if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") prev();
        else return;
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          toggle();
          break;
        case "ArrowRight":
          seekBy(SEEK_SMALL_MS);
          break;
        case "ArrowLeft":
          seekBy(-SEEK_SMALL_MS);
          break;
        case "l":
        case "L":
          seekBy(SEEK_LARGE_MS);
          break;
        case "j":
        case "J":
          seekBy(-SEEK_LARGE_MS);
          break;
        case "ArrowUp":
          adjustVolume(1);
          break;
        case "ArrowDown":
          adjustVolume(-1);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "n":
        case "N":
          next();
          break;
        case "p":
        case "P":
          prev();
          break;
        case "s":
        case "S":
          toggleShuffle();
          break;
        case "r":
        case "R":
          cycleRepeat();
          break;
        case "q":
        case "Q":
          toggleQueuePanel();
          break;
        case "f":
        case "F":
          onToggleFavorite?.();
          break;
        default:
          return;
      }

      e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    toggle,
    next,
    prev,
    seekBy,
    adjustVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueuePanel,
    onToggleFavorite,
  ]);
}
