import { useEffect, useRef, useState } from 'react';
import { getRatings, setRating, type RatingSummary } from '../api.ts';
import { applyVote } from '../rating.ts';

type Vote = -1 | 1;

export default function RatingButtons({ artist, title }: { artist: string; title: string }) {
  const [ratings, setRatings] = useState<RatingSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const currentKey = useRef('');
  currentKey.current = `${artist}|${title}`;

  useEffect(() => {
    let stale = false;
    setRatings(null);
    setFailed(false);
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
    setBusy(true);
    setFailed(false);
    try {
      const saved = await setRating(artist, title, value);
      if (currentKey.current === key) setRatings(saved); // ignore if the track changed meanwhile
    } catch {
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
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:opacity-50 ${
        ratings?.mine === v
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="tabular-nums">{count ?? '–'}</span>
    </button>
  );

  return (
    <div className="mt-4 flex items-center gap-2">
      {button(1, 'I like this track', ratings?.up, '👍')}
      {button(-1, "I don't like this track", ratings?.down, '👎')}
      {failed && (
        <span role="alert" className="text-xs text-amber-700">
          Couldn't save your rating.
        </span>
      )}
    </div>
  );
}
