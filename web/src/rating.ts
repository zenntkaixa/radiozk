import type { RatingSummary } from './api.ts';

/** Optimistically apply a vote (or a clear, when `next` is 0) to the counts. */
export function applyVote(r: RatingSummary, next: -1 | 0 | 1): RatingSummary {
  const up = r.up - (r.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
  const down = r.down - (r.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
  return { up, down, mine: next };
}
