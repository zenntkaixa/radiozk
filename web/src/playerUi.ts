// Small pure helpers for the player UI, kept out of the components so they can be unit-tested without a browser.

type KeyLike = { code: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; target: EventTarget | null };

// Space toggles play/pause unless the key already does something where focus is: it activates buttons and links,
// selects radios and checkboxes, and types in text fields. A range slider ignores it, so that one is let through.
const OWNS_SPACE = 'input:not([type="range"]), button, select, textarea, a, [contenteditable="true"]';

export function isPlayPauseKey(e: KeyLike): boolean {
  if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  const el = e.target as Element | null;
  return !(el && typeof el.closest === 'function' && el.closest(OWNS_SPACE));
}

// The browser tab shows what is on while the stream plays, and goes back to the page title otherwise.
export function pageTitle(base: string, playing: boolean, track?: { title: string } | null): string {
  return playing && track?.title ? `${track.title} · radiozk` : base;
}
