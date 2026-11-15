import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useRadio } from '../hooks/RadioProvider.tsx';
import { splitTitle } from '../playerUi.ts';

/** The mini-player shows on every page but the Radio page, once the radio has been started. */
export function useMiniPlayerVisible(): boolean {
  const { pathname } = useLocation();
  const { status, mode } = useRadio();
  return pathname !== '/' && status !== 'idle' && mode !== 'unsupported';
}

export default function MiniPlayer() {
  const { status, track, togglePlay } = useRadio();
  const [failedCover, setFailedCover] = useState<string | null>(null); // a new track gets a fresh attempt
  if (!useMiniPlayerVisible()) return null;
  const active = status === 'playing' || status === 'buffering';
  const sub = { idle: '', buffering: 'Buffering…', playing: track?.artist ? `Live · ${track.artist}` : 'Live', paused: 'Paused', error: 'Error' }[status];

  return (
    <aside
      aria-label="Mini player"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <button
          onClick={togglePlay}
          aria-label={active ? 'Pause' : 'Play'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          {active ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        {track?.coverUrl && failedCover !== track.coverUrl && (
          <img
            src={track.coverUrl}
            alt=""
            width={40}
            height={40}
            onError={() => setFailedCover(track.coverUrl)}
            className="h-10 w-10 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 object-cover shadow-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug">{track?.title ? splitTitle(track.title).main : 'radiozk live'}</p>
          <p className="truncate text-xs text-slate-600 dark:text-slate-400">{sub}</p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded text-sm font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          Open player
        </Link>
      </div>
    </aside>
  );
}
