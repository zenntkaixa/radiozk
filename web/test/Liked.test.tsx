import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Liked from '../src/pages/Liked.tsx';
import { getLiked, setLiked } from '../src/liked.ts';

beforeEach(() => localStorage.clear());
const show = () => render(<MemoryRouter><Liked /></MemoryRouter>);

describe('Liked page', () => {
  it('explains the empty state', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Liked songs' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it('lists songs with a YouTube search link and removes one', async () => {
    setLiked('Queen', 'Radio Ga Ga', true);
    setLiked('Bowie', 'Heroes', true);
    show();
    expect(screen.getByRole('link', { name: /Radio Ga Ga/ })).toHaveAttribute('href', expect.stringContaining('youtube.com/results'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Heroes from liked songs' }));
    expect(screen.queryByText('Heroes')).toBeNull();
    expect(getLiked().map((s) => s.title)).toEqual(['Radio Ga Ga']);
  });

  it('shows when each song was liked, with the year only when it is not this year', () => {
    setLiked('Queen', 'Radio Ga Ga', true, new Date(2020, 5, 15, 12).getTime());
    setLiked('Bowie', 'Heroes', true, Date.now());
    show();
    const times = document.querySelectorAll('time');
    expect(times).toHaveLength(2);
    expect(times[0].getAttribute('datetime')).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(times[0].textContent).not.toContain(String(new Date().getFullYear()));
    expect(times[1].textContent).toContain('2020');
  });
});
