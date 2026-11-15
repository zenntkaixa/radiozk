import { useEffect, useRef, useState } from 'react';
import { getRatings, setRating, type RatingSummary } from '../api.ts';
import { shouldAskFeedback, FEEDBACK_URL } from '../feedback.ts';
import { setLiked } from '../liked.ts';
import { applyVote } from '../rating.ts';

type Vote = -1 | 1;

export default function RatingButtons({ artist, title }: { artist: string; title: string }) {
  const [ratings, setRatings] = useState<RatingSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const currentKey = useRef('');
  currentKey.current = `${artist}|${title}`;

  useEffect(() => {
    let stale = false;
    setRatings(null);
    setFailed(false);
    setNudge(false); // the ask belongs to the moment of the like, not to the next song
    getRatings(artist, title)
      .then((r) => !stale && setRatings(r))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [artist, title]);

  async function vote(v: Vote) {
    if (!ratings || busy) return;
    const key = currentKey.current;
    const before = ratings;
    const value = before.mine === v ? 0 : v; // tapping your current vote clears it
    setRatings(applyVote(before, value));
    const liked = setLiked(artist, title, value === 1); // personal copy; a 👎 or a cleared vote removes it
    if (value === 1 && shouldAskFeedback(liked.length)) setNudge(true); // a quiet, one-time ask after a few likes
    setBusy(true);
    setFailed(false);
    try {
      const saved = await setRating(artist, title, value);
      if (currentKey.current === key) setRatings(saved); // ignore if the track changed meanwhile
    } catch {
      setLiked(artist, title, before.mine === 1); // undo the personal copy, even if the track changed meanwhile
      if (currentKey.current === key) {
        setRatings(before);
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const button = (v: Vote, label: string, count: number | undefined, icon: string) => (
    <button
      type="button"
      onClick={() => vote(v)}
      disabled={!ratings || busy}
      aria-pressed={ratings?.mine === v}
      aria-label={label}
      className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:opacity-50 ${
        ratings?.mine === v
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {count !== 0 && <span className="tabular-nums">{count ?? '–'}</span>}
    </button>
  );

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">Rate this track</span>
        {button(1, 'I like this track', ratings?.up, '👍')}
        {button(-1, "I don't like this track", ratings?.down, '👎')}
        {failed && (
          <span role="alert" className="text-xs text-amber-700 dark:text-amber-400">
            Couldn't save your rating.
          </span>
        )}
      </div>
      {nudge && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span>
            Glad you like it! Got an idea or a problem?{' '}
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              Tell me on GitHub
            </a>{' '}
            (free account, public).
          </span>
          <button type="button" onClick={() => setNudge(false)} aria-label="Dismiss" className="min-h-11 min-w-11 shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300">✕</button>
        </p>
      )}
    </div>
  );
}
