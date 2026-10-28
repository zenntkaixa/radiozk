// Pure request validation for the ratings API (no I/O, so it is unit-testable without a database).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_ARTIST = 200;
export const MAX_TITLE = 300;

export const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Lower-cased `artist|title` with whitespace collapsed: the identity of a track. */
export const trackKey = (artist, title) => `${norm(artist)}|${norm(title)}`.toLowerCase();

/** Returns { listener, artist, title, key } or { error } (a message for a 400 response). */
export function parseTrackRequest(listenerHeader, source) {
  const listener = String(listenerHeader ?? '');
  const artist = norm(source?.artist);
  const title = norm(source?.title);
  if (!UUID_RE.test(listener)) return { error: 'valid X-Listener-Id header required' };
  if (!title || artist.length > MAX_ARTIST || title.length > MAX_TITLE) return { error: 'artist/title invalid' };
  return { listener, artist, title, key: trackKey(artist, title) };
}

export const isRatingValue = (v) => v === 1 || v === -1 || v === 0;
