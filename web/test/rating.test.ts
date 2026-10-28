import { describe, expect, it } from 'vitest';
import { applyVote } from '../src/rating.ts';

describe('applyVote', () => {
  it('adds a first up vote', () => {
    expect(applyVote({ up: 2, down: 1, mine: 0 }, 1)).toEqual({ up: 3, down: 1, mine: 1 });
  });
  it('adds a first down vote', () => {
    expect(applyVote({ up: 2, down: 1, mine: 0 }, -1)).toEqual({ up: 2, down: 2, mine: -1 });
  });
  it('moves a vote from up to down', () => {
    expect(applyVote({ up: 2, down: 1, mine: 1 }, -1)).toEqual({ up: 1, down: 2, mine: -1 });
  });
  it('moves a vote from down to up', () => {
    expect(applyVote({ up: 2, down: 1, mine: -1 }, 1)).toEqual({ up: 3, down: 0, mine: 1 });
  });
  it('clears an up vote', () => {
    expect(applyVote({ up: 2, down: 1, mine: 1 }, 0)).toEqual({ up: 1, down: 1, mine: 0 });
  });
  it('clears a down vote', () => {
    expect(applyVote({ up: 2, down: 1, mine: -1 }, 0)).toEqual({ up: 2, down: 0, mine: 0 });
  });
  it('does not mutate its input', () => {
    const r = { up: 1, down: 1, mine: 0 as const };
    applyVote(r, 1);
    expect(r).toEqual({ up: 1, down: 1, mine: 0 });
  });
});
