import { useEffect, useState } from 'react';
import type { NowPlaying } from '../nowPlaying.ts';
import { useMediaSession } from '../hooks/useMediaSession.ts';
import { useRadioStream } from '../hooks/useRadioStream.ts';

export default function RadioPlayer({ track }: { track?: NowPlaying | null }) {
  const { audioRef, audioProps, mode, quality, status, info, notice, togglePlay, changeQuality } = useRadioStream();
  const [volume, setVolume] = useState(0.8);
  useMediaSession(track, status !== 'idle'); // idle until the first Play

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [audioRef, volume]);

  const label = { idle: 'Ready', buffering: 'Buffering…', playing: 'Live', paused: 'Paused', error: 'Error' }[status];

  if (mode === 'unsupported') {
    return <p className="text-red-700">This browser can't play HLS streams.</p>;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <audio ref={audioRef} {...audioProps} />

      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          aria-label={status === 'playing' || status === 'buffering' ? 'Pause' : 'Play'}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          {status === 'playing' || status === 'buffering' ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div>
          <p className="text-lg font-semibold">radiozk live</p>
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <span className={`h-2 w-2 rounded-full ${status === 'playing' ? 'animate-pulse bg-red-500' : 'bg-slate-300'}`} />
            {label}
            {info && <span className="text-slate-400">·</span>}
            {info && (
              <span className={info.lossless ? 'font-medium text-indigo-600' : ''}>
                {info.codec}
                {info.lossless && ' · lossless'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="vol" className="text-sm text-slate-600">Volume</label>
        <input
          id="vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-indigo-600"
        />
      </div>

      {mode === 'hls.js' && (
        <fieldset className="mt-4 flex gap-4 text-sm">
          <legend className="sr-only">Stream quality</legend>
          {(['lossless', 'aac'] as const).map((q) => (
            <label key={q} className="flex items-center gap-2">
              <input type="radio" name="quality" checked={quality === q} onChange={() => changeQuality(q)} className="accent-indigo-600" />
              {q === 'lossless' ? 'Lossless (FLAC)' : 'Compatibility (AAC)'}
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'native' && <p className="mt-4 text-sm text-slate-500">Your browser plays the stream natively and chooses the quality automatically.</p>}
      {notice && <p className="mt-4 text-sm text-amber-700">{notice}</p>}
    </section>
  );
}
