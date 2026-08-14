import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  createPlaylist,
  deletePlaylist,
  deletePlaylistCover,
  formatBytes,
  formatDuration,
  getPlaylist,
  setPlaylistSongs,
  sumSongStats,
  type Playlist,
  type Song,
  uploadPlaylistCover,
  updatePlaylist,
} from "../../lib/subsonic/client";
import { Cover } from "./Cover";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";
import { notifyPlaylistsChanged } from "../../lib/events";

type PlaylistDetail = Playlist & { entry?: Song[] };

const COVER_MAX_BYTES = 10 * 1024 * 1024;
const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function validateCoverFile(file: File): string | null {
  if (file.size > COVER_MAX_BYTES) return "Cover must be 10 MB or smaller";
  if (file.type && !COVER_TYPES.has(file.type)) {
    return "Cover must be JPEG, PNG, GIF, or WebP";
  }
  return null;
}

export function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useSettings();
  const { playTracks } = usePlayer();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [cover, setCover] = useState<string | undefined>();
  const [editName, setEditName] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [menuBusy, setMenuBusy] = useState<"duplicate" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  // Drag events fire faster than React commits state, so the authoritative
  // source index lives in a ref and the state copy only drives styling.
  const dragFrom = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [suppressPlayClick, setSuppressPlayClick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverRevRef = useRef(0);

  const loadPlaylist = useCallback(
    async (rev?: number) => {
      if (!auth || !id) return;
      const bust = rev ?? coverRevRef.current;
      const data = await getPlaylist(auth, id);
      const url = await coverArtUrl(auth, data.coverArt ?? data.id, 600, bust || undefined);
      setPlaylist(data);
      setCover(url);
      setEditName(data.name);
      setEditComment(data.comment ?? "");
    },
    [auth, id],
  );

  useEffect(() => {
    if (!auth || !id) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        await loadPlaylist();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, id, loadPlaylist]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!pendingCoverFile) {
      setPendingCoverUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingCoverFile);
    setPendingCoverUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingCoverFile]);

  const stats = useMemo(() => sumSongStats(playlist?.entry ?? []), [playlist?.entry]);

  function closeEditor() {
    if (savingMeta) return;
    setEditing(false);
    setPendingCoverFile(null);
    setRemoveCover(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function openEditor() {
    if (!playlist) return;
    setMenuOpen(false);
    setEditName(playlist.name);
    setEditComment(playlist.comment ?? "");
    setPendingCoverFile(null);
    setRemoveCover(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
    setEditing(true);
  }

  function onCoverPicked(file: File | null) {
    if (!file) {
      setPendingCoverFile(null);
      return;
    }
    const problem = validateCoverFile(file);
    if (problem) {
      setError(problem);
      if (coverInputRef.current) coverInputRef.current.value = "";
      return;
    }
    setError(null);
    setRemoveCover(false);
    setPendingCoverFile(file);
  }

  async function buildTracks(): Promise<PlayerTrack[]> {
    if (!playlist?.entry?.length || !auth) return [];
    return Promise.all(
      playlist.entry.map(async (s) => ({
        ...s,
        coverUrl: (await coverArtUrl(auth, s.coverArt, 300)) ?? cover,
      })),
    );
  }

  async function playFrom(index: number, shuffle = false) {
    if (!playlist) return;
    const tracks = await buildTracks();
    if (!tracks.length) return;
    await playTracks(tracks, index, {
      ...(shuffle ? { shuffle: true } : {}),
      source: { kind: "playlist", id: playlist.id, name: playlist.name },
    });
  }

  async function saveMetadata(e: FormEvent) {
    e.preventDefault();
    if (!auth || !playlist || savingMeta) return;
    const nextName = editName.trim();
    if (!nextName) return;
    const nextComment = editComment.trim();
    setSavingMeta(true);
    setError(null);
    try {
      await updatePlaylist(auth, playlist.id, {
        name: nextName,
        comment: nextComment,
      });
      if (pendingCoverFile) {
        await uploadPlaylistCover(auth, playlist.id, pendingCoverFile);
      } else if (removeCover) {
        await deletePlaylistCover(auth, playlist.id);
      }
      const nextRev = Date.now();
      coverRevRef.current = nextRev;
      setPlaylist((prev) =>
        prev ? { ...prev, name: nextName, comment: nextComment || undefined } : prev,
      );
      setPendingCoverFile(null);
      setRemoveCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
      await loadPlaylist(nextRev);
      setEditing(false);
      notifyPlaylistsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeta(false);
    }
  }

  async function duplicateCurrentPlaylist() {
    if (!auth || !playlist || menuBusy) return;
    setMenuBusy("duplicate");
    setError(null);
    try {
      const songs = (playlist.entry ?? []).map((s) => s.id);
      const copy = await createPlaylist(auth, `${playlist.name} (Copy)`, songs);
      if (playlist.comment?.trim()) {
        await updatePlaylist(auth, copy.id, { comment: playlist.comment });
      }
      setMenuOpen(false);
      notifyPlaylistsChanged();
      navigate(`/playlist/${copy.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMenuBusy(null);
    }
  }

  async function deleteCurrentPlaylist() {
    if (!auth || !playlist || menuBusy) return;
    setMenuBusy("delete");
    setError(null);
    try {
      await deletePlaylist(auth, playlist.id);
      setConfirmDeleteOpen(false);
      setMenuOpen(false);
      notifyPlaylistsChanged();
      navigate("/playlists");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMenuBusy(null);
    }
  }

  function openDeleteConfirm() {
    setMenuOpen(false);
    setConfirmDeleteOpen(true);
  }

  function closeDeleteConfirm() {
    if (menuBusy === "delete") return;
    setConfirmDeleteOpen(false);
  }

  async function reorderSongs(fromIndex: number, toIndex: number) {
    if (!auth || !playlist || savingOrder) return;
    const current = playlist.entry ?? [];
    if (
      fromIndex < 0 ||
      fromIndex >= current.length ||
      toIndex < 0 ||
      toIndex >= current.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const next = [...current];
    const [song] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, song);
    setPlaylist((prev) => (prev ? { ...prev, entry: next } : prev));
    setSavingOrder(true);
    try {
      await setPlaylistSongs(
        auth,
        playlist.id,
        next.map((s) => s.id),
      );
    } catch (err) {
      setPlaylist((prev) => (prev ? { ...prev, entry: current } : prev));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingOrder(false);
    }
  }

  function onSongDragStart(index: number, e: DragEvent<HTMLLIElement>) {
    if (savingOrder) {
      e.preventDefault();
      return;
    }
    dragFrom.current = index;
    setDragFromIndex(index);
    setSuppressPlayClick(true);
    e.dataTransfer.effectAllowed = "move";
    // A drag carrying no payload is treated as invalid and shows the "no drop"
    // cursor, so the row index goes along for the ride even though the reorder
    // reads it from the ref.
    e.dataTransfer.setData("text/plain", String(index));
  }

  function onSongDragOver(index: number, e: DragEvent<HTMLLIElement>) {
    if (dragFrom.current == null) return;
    // preventDefault has to run on every dragover, including over the row being
    // dragged: skipping it marks that row as an invalid target and the cursor
    // stays a "no drop" sign for the whole gesture.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (index !== dragFrom.current) setDragOverIndex(index);
    else setDragOverIndex(null);
  }

  function onSongDrop(index: number, e: DragEvent<HTMLLIElement>) {
    e.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragFromIndex(null);
    setDragOverIndex(null);
    window.setTimeout(() => setSuppressPlayClick(false), 0);
    if (from == null || from === index) return;
    void reorderSongs(from, index);
  }

  function onSongDragEnd() {
    dragFrom.current = null;
    setDragFromIndex(null);
    setDragOverIndex(null);
    window.setTimeout(() => setSuppressPlayClick(false), 0);
  }

  if (!playlist) {
    if (error) return <p className="error">{error}</p>;
    return <p className="muted">Loading playlist...</p>;
  }

  const editorCover = removeCover ? undefined : (pendingCoverUrl ?? cover);

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="detail-hero">
        <Cover src={cover} />
        <div>
          <p className="muted" style={{ margin: "0 0 0.35rem" }}>
            Playlist
          </p>
          <h1>{playlist.name}</h1>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            {stats.count} songs
          </p>
          {playlist.comment ? (
            <p className="muted playlist-comment">{playlist.comment}</p>
          ) : (
            <p className="muted playlist-comment">No description</p>
          )}
          <div className="hero-actions">
            <button className="btn" type="button" onClick={() => void playFrom(0)}>
              Play
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => void playFrom(0, true)}
            >
              Shuffle
            </button>
            <div className="playlist-menu-wrap" ref={menuRef}>
              <button
                className="kebab-btn"
                type="button"
                aria-label="Playlist actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span />
                <span />
                <span />
              </button>
              {menuOpen && (
                <div className="playlist-menu" role="menu">
                  <button type="button" role="menuitem" onClick={openEditor}>
                    Edit details
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={menuBusy != null}
                    onClick={() => void duplicateCurrentPlaylist()}
                  >
                    {menuBusy === "duplicate" ? "Duplicating..." : "Duplicate playlist"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={menuBusy != null}
                    onClick={openDeleteConfirm}
                  >
                    Delete playlist
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div className="modal-card playlist-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="playlist-edit-head">
              <h2 className="panel-title">Edit details</h2>
              <button
                className="modal-close-btn"
                type="button"
                aria-label="Close editor"
                disabled={savingMeta}
                onClick={closeEditor}
              >
                ×
              </button>
            </div>
            <form className="form playlist-edit-grid" onSubmit={saveMetadata}>
              <div className="playlist-edit-art">
                <Cover src={editorCover} alt={playlist.name} />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="visually-hidden"
                  onChange={(e) => onCoverPicked(e.target.files?.[0] ?? null)}
                />
                <div className="cover-upload-actions">
                  <button
                    className="cover-upload-btn"
                    type="button"
                    disabled={savingMeta}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {pendingCoverFile ? "Change cover" : "Edit cover"}
                  </button>
                  {(cover || pendingCoverFile) && !removeCover && (
                    <button
                      className="cover-remove-btn"
                      type="button"
                      disabled={savingMeta}
                      onClick={() => {
                        setPendingCoverFile(null);
                        setRemoveCover(true);
                        if (coverInputRef.current) coverInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  )}
                  {removeCover && (
                    <button
                      className="cover-upload-btn"
                      type="button"
                      disabled={savingMeta}
                      onClick={() => setRemoveCover(false)}
                    >
                      Undo remove
                    </button>
                  )}
                </div>
              </div>
              <div className="playlist-edit-fields">
                <label>
                  Name
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={120}
                    disabled={savingMeta}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    rows={8}
                    placeholder="Add an optional description"
                    maxLength={1000}
                    disabled={savingMeta}
                  />
                </label>
                <div className="form-actions playlist-edit-actions">
                  <button className="btn" type="submit" disabled={savingMeta || !editName.trim()}>
                    {savingMeta ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDeleteOpen && (
        <div className="modal-backdrop" onClick={closeDeleteConfirm}>
          <div
            className="modal-card confirm-modal"
            role="alertdialog"
            aria-labelledby="delete-playlist-title"
            aria-describedby="delete-playlist-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-playlist-title" className="panel-title">
              Delete playlist?
            </h2>
            <p id="delete-playlist-desc" className="confirm-modal-copy">
              Delete <strong>{playlist.name}</strong>? This can’t be undone.
            </p>
            <div className="confirm-modal-actions">
              <button
                className="btn secondary"
                type="button"
                disabled={menuBusy === "delete"}
                onClick={closeDeleteConfirm}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={menuBusy === "delete"}
                onClick={() => void deleteCurrentPlaylist()}
              >
                {menuBusy === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ul className="track-list">
        {(playlist.entry ?? []).map((song, i) => (
          <li
            key={`${song.id}-${i}`}
            className={`track-row${dragOverIndex === i ? " is-drop-target" : ""}${dragFromIndex === i ? " is-dragging" : ""}`}
            draggable={!savingOrder}
            onDragStart={(e) => onSongDragStart(i, e)}
            onDragEnter={(e) => onSongDragOver(i, e)}
            onDragOver={(e) => onSongDragOver(i, e)}
            onDrop={(e) => onSongDrop(i, e)}
            onDragEnd={onSongDragEnd}
            onClick={() => {
              if (suppressPlayClick) return;
              void playFrom(i);
            }}
          >
            <span className="num">{i + 1}</span>
            <span className="playlist-track-main">
              <span className="drag-handle" aria-hidden>
                ⋮⋮
              </span>
              <span>
                <div>{song.title}</div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {song.artist}
                  {song.album ? ` · ${song.album}` : ""}
                </div>
              </span>
            </span>
            <span className="track-row-actions">
              <span className="dur">{formatDuration(song.duration)}</span>
            </span>
          </li>
        ))}
      </ul>
      <footer className="playlist-stats">
        <div>
          <span className="stat-label">Songs</span>
          <span className="stat-value">{stats.count}</span>
        </div>
        <div>
          <span className="stat-label">Length</span>
          <span className="stat-value">{formatDuration(stats.durationSec)}</span>
        </div>
        <div>
          <span className="stat-label">Size</span>
          <span className="stat-value">{formatBytes(stats.sizeBytes)}</span>
        </div>
      </footer>
    </div>
  );
}
