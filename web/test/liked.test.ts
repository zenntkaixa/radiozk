import { beforeEach, describe, expect, it } from 'vitest';
import { getLiked, setLiked } from '../src/liked.ts';

beforeEach(() => localStorage.clear());

describe('liked songs', () => {
  it('adds newest first, without duplicates, and removes', () => {
    setLiked('A', 'One', true, 1);
    setLiked('B', 'Two', true, 2);
    setLiked('A', 'One', true, 3); // liked again: moves to the front, not twice
    expect(getLiked().map((s) => s.title)).toEqual(['One', 'Two']);
    setLiked('A', 'One', false);
    expect(getLiked()).toEqual([{ artist: 'B', title: 'Two', likedAt: 2 }]);
  });

  it('keeps at most 200 and ignores corrupt storage', () => {
    for (let i = 0; i < 205; i++) setLiked('A', `T${i}`, true, i);
    expect(getLiked()).toHaveLength(200);
    expect(getLiked()[0].title).toBe('T204');
    localStorage.setItem('radiozk.liked', '{nope');
    expect(getLiked()).toEqual([]);
    localStorage.setItem('radiozk.liked', JSON.stringify([{ title: 1 }, { artist: 'A', title: 'T', likedAt: 1 }]));
    expect(getLiked()).toHaveLength(1);
  });
});
