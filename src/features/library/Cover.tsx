import { Link } from "react-router-dom";
import type { Album, Playlist } from "../../lib/subsonic/client";

export function Cover({
  src,
  className,
  alt = "",
}: {
  src?: string;
  className?: string;
  alt?: string;
}) {
  const classes = ["album-art", className].filter(Boolean).join(" ");
  if (src) return <img className={classes} src={src} alt={alt} loading="lazy" />;
  return <div className={`cover-fallback ${classes}`} aria-hidden />;
}

export function AlbumCard({
  album,
  coverUrl,
}: {
  album: Album;
  coverUrl?: string;
}) {
  return (
    <Link className="album-tile" to={`/album/${album.id}`}>
      <Cover src={coverUrl} alt={album.name} />
      <div className="meta">
        <div className="title">{album.name}</div>
        <div className="artist">{album.artist}</div>
      </div>
    </Link>
  );
}

export function PlaylistCard({
  playlist,
  coverUrl,
}: {
  playlist: Playlist;
  coverUrl?: string;
}) {
  return (
    <Link className="album-tile" to={`/playlist/${playlist.id}`}>
      <Cover src={coverUrl} alt={playlist.name} />
      <div className="meta">
        <div className="title">{playlist.name}</div>
        <div className="artist">{playlist.songCount ?? 0} tracks</div>
      </div>
    </Link>
  );
}
