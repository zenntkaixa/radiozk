const POLL_MS = 250;
const MAX_WAIT_MS = 8000;

/**
 * Runs `fn` as background work: after `delayMs`, once every <img> on the page has finished loading (so it never
 * competes with the cover that is the largest contentful paint), and then when the browser is idle. Gives up
 * waiting for images after MAX_WAIT_MS. Returns a function that cancels it.
 */
export function whenIdle(fn: () => void, delayMs = 2000): () => void {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idleId: number | undefined;
  const imagesLoading = () => Array.from(document.images).some((img) => !img.complete);
  const attempt = () => {
    if (imagesLoading() && Date.now() - started < MAX_WAIT_MS) {
      timer = setTimeout(attempt, POLL_MS);
    } else if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(fn, { timeout: 3000 });
    } else {
      fn();
    }
  };
  timer = setTimeout(attempt, delayMs);
  return () => {
    clearTimeout(timer);
    if (idleId !== undefined) cancelIdleCallback(idleId);
  };
}

/** True when the user asked the browser to save data; background prefetching should be skipped then. */
export const saveDataRequested = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
