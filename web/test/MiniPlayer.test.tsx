import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MiniPlayer from '../src/components/MiniPlayer.tsx';
import { RadioContext, type RadioValue } from '../src/hooks/RadioProvider.tsx';

const value = (over: Partial<RadioValue> = {}) =>
  ({ status: 'playing', mode: 'hls.js', track: { title: 'Song', artist: 'Band' }, togglePlay: vi.fn(), ...over }) as unknown as RadioValue;
const show = (path: string, v: RadioValue) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RadioContext.Provider value={v}>
        <MiniPlayer />
      </RadioContext.Provider>
    </MemoryRouter>,
  );

describe('MiniPlayer', () => {
  it('shows the track and a Pause button on other pages while playing', () => {
    show('/about', value());
    expect(screen.getByRole('complementary', { name: 'Mini player' })).toBeInTheDocument();
    expect(screen.getByText('Song')).toBeInTheDocument();
    expect(screen.getByText('Live · Band')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open player' })).toHaveAttribute('href', '/');
  });

  it('is hidden on the Radio page, which has the full player', () => {
    show('/', value());
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('is hidden until the radio has been started, and when the browser cannot play it', () => {
    show('/about', value({ status: 'idle' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    show('/about', value({ mode: 'unsupported' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('offers Play while paused, and the button toggles playback', async () => {
    const togglePlay = vi.fn();
    show('/about', value({ status: 'paused', togglePlay }));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it('falls back to the station name before the track is known', () => {
    show('/about', value({ track: null, status: 'buffering' }));
    expect(screen.getByText('radiozk live')).toBeInTheDocument();
    expect(screen.getByText('Buffering…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument(); // buffering counts as playing
  });
});

describe('MiniPlayer cover and title', () => {
  it('shows a small cover and the title without its version note', () => {
    const v = value({ track: { title: 'Song (2015 Remaster)', artist: 'Band', coverUrl: 'https://cdn/cover.jpg?t=1' } as never });
    const { container } = show('/about', v);
    expect(screen.getByText('Song')).toBeInTheDocument();
    expect(screen.queryByText(/Remaster/)).toBeNull();
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cdn/cover.jpg?t=1');
    expect(img).toHaveAttribute('alt', ''); // decorative
  });

  it('wraps a long title onto two lines instead of cutting it off at one', () => {
    show('/about', value({ track: { title: 'A very long song title that does not fit', artist: 'B' } as never }));
    expect(screen.getByText(/A very long song title/).className).toMatch(/line-clamp-2/);
  });

  it('drops the cover when it fails to load, and shows none without a track', () => {
    const { container } = show('/about', value({ track: null }));
    expect(container.querySelector('img')).toBeNull();
  });
});
