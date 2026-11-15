// Songs the listener gave a thumbs up, kept only in this browser (the vote itself still goes to the API).
// No cover: cover.jpg is overwritten in place, so a saved URL would soon show another track's art.
export type LikedSong = { artist: string; title: string; likedAt: number };

const KEY = 'radiozk.liked';
const MAX = 200; // shortcut: oldest drop off at 200, enough for a hobby list; revisit if it ever syncs to the server

const same = (a: { artist: string; title: string }, b: { artist: string; title: string }) => a.artist === b.artist && a.title === b.title;

export function getLiked(): LikedSong[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s): s is LikedSong => typeof s?.title === 'string' && typeof s?.artist === 'string' && typeof s?.likedAt === 'number') : [];
  } catch {
    return [];
  }
}

/** Add (on) or remove (off) a song; newest first, no duplicates. Returns the new list. */
export function setLiked(artist: string, title: string, on: boolean, now = Date.now()): LikedSong[] {
  const song = { artist, title };
  const rest = getLiked().filter((s) => !same(s, song));
  const next = on ? [{ ...song, likedAt: now }, ...rest].slice(0, MAX) : rest;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked or full: the vote still counts, the personal list just isn't kept */
  }
  return next;
}
