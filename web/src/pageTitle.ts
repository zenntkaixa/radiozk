import { useEffect } from 'react';

// The title index.html ships with, read once when the app loads (before any page has changed it), so that every
// page can put it back however the visitor navigated.
export const BASE_TITLE = typeof document === 'undefined' ? 'radiozk' : document.title;

// Two things set the tab title: the page being shown, and the track that is playing. The track wins, on any page
// (the radio keeps playing across pages). A single place decides, so neither can overwrite the other.
let pageTitleNow = BASE_TITLE;
let playingTitle: string | null = null;
const apply = () => {
  document.title = playingTitle ?? pageTitleNow;
};

/** The title for the playing track, or null to go back to the page's own title. */
export function setPlayingTitle(title: string | null) {
  playingTitle = title;
  apply();
}

/** Sets the page's title while it is shown and restores the base title afterwards. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    pageTitleNow = title;
    apply();
    return () => {
      pageTitleNow = BASE_TITLE;
      apply();
    };
  }, [title]);
}
