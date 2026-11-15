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
