// Who is listening right now: listener id -> time of the last heartbeat, in memory.
// shortcut: one API process only (Render's free plan runs one); counts reset on restart and rebuild within one
// heartbeat. Move to a shared store if the API is ever scaled out.
export const PRESENCE_TTL_MS = 60_000; // a listener counts for this long after the last heartbeat
const MAX_LISTENERS = 5_000; // memory cap against a flood of made-up ids

export function createPresence({ now = Date.now, ttlMs = PRESENCE_TTL_MS, max = MAX_LISTENERS } = {}) {
  const seen = new Map();

  function prune() {
    const cutoff = now() - ttlMs;
    for (const [id, at] of seen) if (at <= cutoff) seen.delete(id);
  }

  return {
    beat(id) {
      if (!seen.has(id) && seen.size >= max) prune();
      if (seen.has(id) || seen.size < max) seen.set(id, now());
    },
    count() {
      prune();
      return seen.size;
    },
  };
}
