import { useEffect, useState } from 'react';
import { useRadio } from '../hooks/RadioProvider.tsx';
import { saveDataRequested } from '../idle.ts';
import ShareButton from './ShareButton.tsx';
import { SLEEP_CHOICES, prefersReducedMotion, presenceParts } from '../playerUi.ts';

/** The player card of the Radio page. The audio itself lives in RadioProvider and keeps going when this unmounts. */
export default function RadioPlayer() {
  const { audioRef, mode, quality, status, info, notice, togglePlay, changeQuality, listening, volume, setVolume, sleep, setSleep } = useRadio();

  // Frequency bars while playing through hls.js (not Safari's native HLS). The chunk loads on first play. The canvas
  // is state, not a ref, so coming back to this page while playing starts the bars again.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const playing = status === 'playing';
  useEffect(() => {
    if (!playing || mode !== 'hls.js' || !canvas || prefersReducedMotion() || saveDataRequested()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    import('../visualizer.ts')
      .then(async ({ startVisualizer }) => {
        if (!audioRef.current || cancelled) return;
        const s = await startVisualizer(audioRef.current, canvas);
        if (cancelled) s?.();
        else stop = s;
      })
      .catch(() => {}); // no visualizer is fine, the radio still plays
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [playing, mode, canvas, audioRef]);

  const presence = presenceParts(listening, status !== 'idle');
  const label = { idle: 'Tap play to listen', buffering: 'Buffering…', playing: 'Live', paused: 'Paused', error: 'Error' }[status];

  if (mode === 'unsupported') {
    return <p className="text-red-700 dark:text-red-400">This browser can't play HLS streams.</p>;
  }

  return (
    <section className="p-6">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {playing && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-indigo-500/50 motion-safe:animate-ring" />}
          <button
            onClick={togglePlay}
            aria-label={status === 'playing' || status === 'buffering' ? 'Pause' : 'Play'}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
          >
            {status === 'playing' || status === 'buffering' ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>
        <div>
          <p className="text-lg font-semibold">radiozk live</p>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300" role="status">
            <span className={`h-2 w-2 rounded-full ${status === 'playing' ? 'animate-pulse bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            {label}
            {info && <span className="text-slate-500 dark:text-slate-400">·</span>}
            {info && (
              <span className={info.lossless ? 'font-medium text-indigo-600 dark:text-indigo-400' : ''}>
                {info.codec}
                {info.lossless && ' · lossless'}
              </span>
            )}
          </p>
        </div>
        <canvas ref={setCanvas} aria-hidden="true" className="h-12 min-w-0 flex-1" />
      </div>

      {/* Each piece stays whole when the line wraps on a phone; the thank-you waits for the first Play. */}
      {presence.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-x-4 text-sm text-slate-600 dark:text-slate-400">
          {presence.map((t) => <span key={t}>{t}</span>)}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="vol" className="text-sm text-slate-600 dark:text-slate-400">Volume</label>
        <input
          id="vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 rounded accent-indigo-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="sleep" className="text-slate-600 dark:text-slate-400">Sleep timer</label>
        <select
          id="sleep"
          value={sleep?.minutes ?? 0}
          onChange={(e) => setSleep(Number(e.target.value) || null)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-900"
        >
          <option value={0}>Off</option>
          {SLEEP_CHOICES.map((m) => (
            <option key={m} value={m}>{m} minutes</option>
          ))}
        </select>
        {sleep && <span className="text-slate-500 dark:text-slate-400" role="status">Stops in {sleep.left} min</span>}
        <span className="sm:ml-auto"><ShareButton /></span>
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
      {mode === 'native' && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Your browser plays the stream natively and chooses the quality automatically.</p>}
      {notice && <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">{notice}</p>}
    </section>
  );
}
