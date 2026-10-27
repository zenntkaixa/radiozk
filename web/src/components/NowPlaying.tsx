import { useState } from 'react';
import type { NowPlaying as NowPlayingData } from '../nowPlaying.ts';
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
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {error ? 'Track info is unavailable right now.' : 'Loading track info…'}
      </section>
    );
  }

  const q = quality(data);
  const subtitle = [data.album, data.year].filter(Boolean).join(' · ');

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Now playing">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Now playing</h2>
      <div className="mt-3 flex gap-4">
        {failedCover === data.coverUrl ? (
          <div className="h-28 w-28 shrink-0 rounded-lg bg-slate-100" aria-hidden="true" />
        ) : (
          <img
            src={data.coverUrl}
            alt={data.album ? `Cover of ${data.album}` : 'Album cover'}
            width={112}
            height={112}
            onError={() => setFailedCover(data.coverUrl)}
            className="h-28 w-28 shrink-0 rounded-lg bg-slate-100 object-cover shadow"
          />
        )}
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug">{data.title || 'Unknown title'}</p>
          <p className="text-slate-700">{data.artist || 'Unknown artist'}</p>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          {q && (
            <p className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {q}
            </p>
          )}
        </div>
      </div>

      {data.title && <RatingButtons artist={data.artist} title={data.title} />}

      {data.previous.length > 0 && (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Recently played</h3>
          <ol className="mt-2 divide-y divide-slate-100 text-sm">
            {data.previous.map((t, i) => (
              <li key={`${i}-${t.artist}-${t.title}`} className="py-1.5">
                <span className="font-medium">{t.title}</span>
                {t.artist && <span className="text-slate-500"> — {t.artist}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {error && <p className="mt-4 text-xs text-amber-700">Couldn't refresh track info; showing the last known track.</p>}
    </section>
  );
}
