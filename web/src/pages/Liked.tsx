import { useState } from 'react';
import { Link } from 'react-router';
import { getLiked, setLiked } from '../liked.ts';
import { useDocumentTitle } from '../pageTitle.ts';
import { searchUrl } from '../playerUi.ts';

/** "15 Nov", with the year when it is not this year. */
const likedOn = (t: number) => {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
};

export default function Liked() {
  useDocumentTitle('Liked · radiozk');
  const [songs, setSongs] = useState(getLiked);

  return (
    <>
      <h1 className="text-2xl font-bold">Liked songs</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">Your 👍 songs, saved on this device only. Clearing your browser data clears them.</p>
      {songs.length === 0 ? (
        <p className="mt-6">
          Nothing here yet. Tap 👍 on a track on the{' '}
          <Link to="/" className="text-indigo-600 underline dark:text-indigo-400">radio page</Link>.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {songs.map((s) => (
            <li key={`${s.artist}|${s.title}`} className="flex items-center gap-3 px-4 py-2">
              <a
                href={searchUrl(s.artist, s.title)}
                target="_blank"
                rel="noopener noreferrer"
                title="Search on YouTube"
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
              >
                <span className="truncate font-medium underline decoration-slate-300 underline-offset-2 dark:decoration-slate-600">{s.title}</span>
                <span className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {s.artist && `${s.artist} · `}liked <time dateTime={new Date(s.likedAt).toISOString()}>{likedOn(s.likedAt)}</time>
                </span>
              </a>
              <button
                type="button"
                onClick={() => setSongs(setLiked(s.artist, s.title, false))}
                aria-label={`Remove ${s.title} from liked songs`}
                className="min-h-11 min-w-11 rounded-full text-slate-500 hover:text-red-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 dark:text-slate-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
