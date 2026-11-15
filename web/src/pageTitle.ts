import { useEffect } from 'react';

// The title index.html ships with, read once when the app loads (before any page has changed it), so that every
// page can put it back however the visitor navigated.
export const BASE_TITLE = typeof document === 'undefined' ? 'radiozk' : document.title;

/** Sets the tab title while the page is shown and restores the base title afterwards. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
