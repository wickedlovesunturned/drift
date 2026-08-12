/** Fired when playlists are created, renamed, or deleted so the sidebar can refresh. */
export const PLAYLISTS_CHANGED_EVENT = "drift:playlists-changed";

export function notifyPlaylistsChanged() {
  window.dispatchEvent(new Event(PLAYLISTS_CHANGED_EVENT));
}
