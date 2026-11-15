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

// "Listening with you": the count is only shown from this many listeners up (fewer looks lonely).
export const MIN_LISTENERS_SHOWN = 3;

export function presenceLine(listening: number | null): string {
  const thanks = 'Arigatou for tuning in ✨';
  return listening !== null && listening >= MIN_LISTENERS_SHOWN ? `🎧 ${listening} listening with you right now · ${thanks}` : thanks;
}

export const searchUrl = (artist: string, title: string) =>
  `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${artist} ${title}`.trim() })}`;

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Brackets (and a trailing " - ...") that only say which release of the song this is. They move under the title as a
// small label. Anything that changes what the song is (feat., live, remix, cover) stays in the title.
const VERSION_WORDS = /\b(remaster(ed)?|version|mix|edit|bonus|soundtrack|mono|stereo|deluxe|expanded|reissue|anniversary|single|album)\b/i;
const KEEP_WORDS = /\b(feat|featuring|ft|with|live|remix|vs|cover|acoustic|demo)\b\.?/i;
const isVersionNote = (s: string) => VERSION_WORDS.test(s) && !KEEP_WORDS.test(s);

/** Splits "Song (2015 Remaster)" into { main: "Song", extra: "2015 Remaster" }. Display only: ratings use the raw title. */
export function splitTitle(title: string): { main: string; extra: string } {
  let main = title;
  const extras: string[] = [];
  for (;;) {
    const m = /\s*[([]([^()[\]]*)[)\]]\s*$/.exec(main) ?? /\s+-\s+([^-]+)$/.exec(main);
    if (!m || !isVersionNote(m[1])) break;
    extras.unshift(m[1].trim());
    main = main.slice(0, m.index).trim();
  }
  return main ? { main, extra: extras.join(' · ') } : { main: title, extra: '' }; // never strip a title to nothing
}
