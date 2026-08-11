import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getStarredSongs, star, unstar, type Song } from "../../lib/subsonic/client";
import { useSettings } from "../settings/SettingsContext";

interface FavoritesContextValue {
  songs: Song[];
  loading: boolean;
  error: string | null;
  isFavorite: (id?: string) => boolean;
  toggleFavorite: (song: Song) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { auth } = useSettings();
  const [songs, setSongs] = useState<Song[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const starred = await getStarredSongs(auth);
      setSongs(starred);
      setIds(new Set(starred.map((s) => s.id)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      setSongs([]);
      setIds(new Set());
      return;
    }
    void refresh();
  }, [auth, refresh]);

  const isFavorite = useCallback((id?: string) => (id ? ids.has(id) : false), [ids]);

  const toggleFavorite = useCallback(
    async (song: Song) => {
      if (!auth || !song.id) return;
      const wasFavorite = ids.has(song.id);

      // Flip locally first so the star reacts instantly, then reconcile on failure.
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
      setSongs((prev) =>
        wasFavorite ? prev.filter((s) => s.id !== song.id) : [{ ...song }, ...prev],
      );

      try {
        if (wasFavorite) await unstar(auth, song.id);
        else await star(auth, song.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        void refresh();
      }
    },
    [auth, ids, refresh],
  );

  const value = useMemo(
    () => ({ songs, loading, error, isFavorite, toggleFavorite, refresh }),
    [songs, loading, error, isFavorite, toggleFavorite, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
