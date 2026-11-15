import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NowPlaying from '../src/components/NowPlaying.tsx';
import type { NowPlaying as Data } from '../src/nowPlaying.ts';

const data: Data = {
  artist: 'Band',
  title: 'Song (2012 Remaster)',
  album: 'Album',
  year: '2012',
  bitDepth: 16,
  sampleRate: 44100,
  coverUrl: 'https://example.test/cover.jpg',
  previous: [
    { artist: 'Queen', title: 'Radio Ga Ga (2011 Remaster)' },
    { artist: 'Bowie', title: 'Heroes (feat. Someone)' },
  ],
};

vi.mock('../src/api.ts', () => ({ getRatings: () => new Promise(() => {}), setRating: vi.fn() })); // RatingButtons: never answers, these tests read the card only

describe('NowPlaying', () => {
  it('shows version notes under the title, and recently played titles without them (searching still uses the raw title)', () => {
    render(<NowPlaying data={data} error={false} />);
    expect(screen.getByText('2012 Remaster')).toBeInTheDocument(); // the small label under the title
    const radio = screen.getByRole('link', { name: 'Radio Ga Ga' });
    expect(radio.getAttribute('href')).toContain(new URLSearchParams({ search_query: 'Queen Radio Ga Ga (2011 Remaster)' }).toString());
    expect(screen.getByRole('link', { name: 'Heroes (feat. Someone)' })).toBeInTheDocument(); // feat. notes stay
  });
});
