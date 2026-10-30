import { useEffect, useState } from 'react';
import { COVER_URL, METADATA_URL } from './config.ts';

const POLL_MS = 10_000; // the server caches the file for 10s

export interface Track {
  artist: string;
  title: string;
}

export interface NowPlaying extends Track {
  album: string;
  year: string;
  bitDepth: number | null;
  sampleRate: number | null;
  previous: Track[];
  coverUrl: string;
}

// The feed has stray whitespace ("Violator ", "Truth  (2006 Remaster)").
const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parse(raw: Record<string, unknown>): NowPlaying {
  const previous: Track[] = [];
  for (let i = 1; i <= 5; i++) {
    const artist = clean(raw[`prev_artist_${i}`]);
    const title = clean(raw[`prev_title_${i}`]);
    if (artist || title) previous.push({ artist, title });
  }
  const artist = clean(raw.artist);
  const title = clean(raw.title);
  return {
    artist,
    title,
    album: clean(raw.album),
    year: clean(raw.date),
    bitDepth: num(raw.bit_depth),
    sampleRate: num(raw.sample_rate),
    previous,
    // cover.jpg is overwritten in place, so key the URL on the track to bypass the browser cache
    coverUrl: `${COVER_URL}?t=${encodeURIComponent(`${artist}|${title}`)}`,
  };
}

declare global {
  interface Window {
    /** Started by the inline script in index.html; resolves to the parsed JSON, or null if the request failed. */
    __earlyMetadata?: Promise<Record<string, unknown> | null>;
  }
}

/** The early request is used at most once; later polls (and a remount) fetch normally. */
function takeEarlyMetadata() {
  const early = window.__earlyMetadata;
  delete window.__earlyMetadata;
  return early;
}

/** Polls the station metadata; pauses while the tab is hidden. `error` is true while the last fetch failed. */
export function useNowPlaying() {
  const [data, setData] = useState<NowPlaying | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;

    let early = takeEarlyMetadata();

    async function tick() {
      clearTimeout(timer);
      ctrl?.abort();
      ctrl = new AbortController();
      const { signal } = ctrl;
      try {
        let raw = early ? await early : null;
        early = undefined;
        if (signal.aborted) return;
        if (!raw) {
          const res = await fetch(METADATA_URL, { signal, cache: 'no-store' });
          if (!res.ok) throw new Error(String(res.status));
          raw = (await res.json()) as Record<string, unknown>;
        }
        const next = parse(raw);
        setData((prev) => (prev && prev.coverUrl === next.coverUrl && prev.previous.length === next.previous.length ? prev : next));
        setError(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError(true);
      }
      if (!document.hidden) timer = setTimeout(tick, POLL_MS);
    }

    const onVisibility = () => {
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
  }, []);

  return { data, error };
}
