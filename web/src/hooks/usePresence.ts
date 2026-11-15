import { useEffect, useState } from 'react';
import { getPresence, sendHeartbeat } from '../api.ts';

export const PRESENCE_MS = 30_000;

/**
 * The live listener count. While `playing`, it sends a heartbeat every 30 s (also in a background tab, since
 * listening goes on) and takes the count from the reply; otherwise it only reads the count, and not while the
 * tab is hidden. Failures keep the last known count.
 */
export function usePresence(playing: boolean): number | null {
  const [listening, setListening] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;

    async function tick() {
      clearTimeout(timer);
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const r = await (playing ? sendHeartbeat(ctrl.signal) : getPresence(ctrl.signal));
        setListening(r.listening);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
      if (playing || !document.hidden) timer = setTimeout(tick, PRESENCE_MS);
    }

    const onVisibility = () => {
      if (playing) return;
      if (document.hidden) {
        clearTimeout(timer);
        ctrl?.abort();
      } else {
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing]);

  return listening;
}
