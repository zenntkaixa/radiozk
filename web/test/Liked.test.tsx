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
});
