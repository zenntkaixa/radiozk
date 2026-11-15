import { useState } from 'react';
import type { NowPlaying as NowPlayingData } from '../nowPlaying.ts';
import { searchUrl, splitTitle } from '../playerUi.ts';
import RatingButtons from './RatingButtons.tsx';

function quality(d: NowPlayingData) {
  if (!d.bitDepth || !d.sampleRate) return null;
  return `${d.bitDepth}-bit / ${d.sampleRate / 1000} kHz`;
}

export default function NowPlaying({ data, error }: { data: NowPlayingData | null; error: boolean }) {
  // Remember which cover failed so a new track gets a fresh attempt.
  const [failedCover, setFailedCover] = useState<string | null>(null);

  if (!data) {
    return (
      <section className="border-t border-slate-100 dark:border-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
        {error ? (
          'Track info is unavailable right now.'
        ) : (
          <>
            <p className="sr-only">Loading track info…</p>
            <div aria-hidden="true" className="flex gap-4 motion-safe:animate-pulse">
              <div className="h-28 w-28 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-40 sm:w-40" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  const q = quality(data);
  const { main: title, extra: version } = splitTitle(data.title || 'Unknown title');
  const subtitle = [data.album, data.year].filter(Boolean).join(' · ');

  return (
    <section className="relative isolate overflow-hidden border-t border-slate-100 dark:border-slate-800 p-6" aria-label="Now playing">
      {/* The cover again, blurred, as a soft backdrop. Same URL, so no extra download; decorative. */}
      {failedCover !== data.coverUrl && (
        <img
          src={data.coverUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 -z-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] object-cover opacity-30 blur-3xl dark:opacity-25"
        />
      )}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Now playing</h2>
      <div className="mt-3 flex gap-4">
        {failedCover === data.coverUrl ? (
          <div className="h-28 w-28 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-40 sm:w-40" aria-hidden="true" />
        ) : (
          <img
            src={data.coverUrl}
            alt={data.album ? `Cover of ${data.album}` : 'Album cover'}
            width={160}
            height={160}
            onError={() => setFailedCover(data.coverUrl)}
            className="h-28 w-28 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 object-cover shadow sm:h-40 sm:w-40"
          />
        )}
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug sm:text-2xl">{title}</p>
          {version && <p className="text-xs text-slate-500 dark:text-slate-400">{version}</p>}
          <p className="text-slate-700 dark:text-slate-300">{data.artist || 'Unknown artist'}</p>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          {q && (
            <p className="mt-2 inline-block rounded-full bg-indigo-50 dark:bg-indigo-950 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {q}
            </p>
          )}
        </div>
      </div>

      {data.title && <RatingButtons artist={data.artist} title={data.title} />}

      {data.previous.length > 0 && (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recently played</h3>
          <ol className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {data.previous.map((t, i) => (
              <li key={`${i}-${t.artist}-${t.title}`}>
                <a
                  href={searchUrl(t.artist, t.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Search on YouTube"
                  className="inline-flex min-h-11 items-center font-medium underline decoration-slate-300 underline-offset-2 hover:decoration-current dark:decoration-slate-600"
                >
                  {t.title}
                </a>
                {t.artist && <span className="text-slate-500 dark:text-slate-400"> — {t.artist}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {error && <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">Couldn't refresh track info; showing the last known track.</p>}
    </section>
  );
}
