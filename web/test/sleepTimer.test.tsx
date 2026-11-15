import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { RadioProvider, useRadio } from '../src/hooks/RadioProvider.tsx';
import RadioPlayer from '../src/components/RadioPlayer.tsx';

const stream = vi.hoisted(() => ({ status: 'playing', togglePlay: vi.fn() }));
// The provider renders the real <audio>, which React ties to audioRef, so read the volume off the element.
const vol = () => document.querySelector('audio')!.volume;

vi.mock('../src/hooks/useRadioStream.ts', () => ({
  useRadioStream: () => ({
    audioRef: { current: null },
    audioProps: {},
    mode: 'hls.js',
    quality: 'lossless',
    status: stream.status,
    info: null,
    notice: null,
    togglePlay: stream.togglePlay,
    changeQuality: vi.fn(),
  }),
}));
vi.mock('../src/nowPlaying.ts', () => ({ useNowPlaying: () => ({ data: null, error: null }) }));
vi.mock('../src/hooks/useMediaSession.ts', () => ({ useMediaSession: () => {} }));
let listening: number | null = null;
vi.mock('../src/hooks/usePresence.ts', () => ({ usePresence: () => listening }));
vi.mock('../src/components/NowPlaying.tsx', () => ({ default: () => null }));

function Probe() {
  const { sleep, setSleep } = useRadio();
  return <button onClick={() => setSleep(15)}>{sleep ? `left ${sleep.left}` : 'off'}</button>;
}
const show = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <RadioProvider>{ui}</RadioProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  stream.status = 'playing';
  stream.togglePlay.mockClear();
  listening = null;
});
afterEach(() => vi.useRealTimers());

describe('sleep timer', () => {
  it('fades out over the last seconds, then pauses once', async () => {
    show(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'off' }));
    expect(screen.getByRole('button', { name: 'left 15' })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(15 * 60000 - 7000));
    expect(vol()).toBe(0.8); // chosen volume, not yet fading
    expect(stream.togglePlay).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(4500)); // 2.5 s left
    expect(vol()).toBeCloseTo(0.4, 1);

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(stream.togglePlay).toHaveBeenCalledTimes(1);
    expect(vol()).toBe(0.8); // restored for the next listen
    expect(screen.getByRole('button', { name: 'off' })).toBeInTheDocument();
  });

  it('does not toggle an already paused stream (that would start it)', async () => {
    stream.status = 'paused';
    show(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'off' }));
    await act(() => vi.advanceTimersByTimeAsync(15 * 60000 + 1000));
    expect(stream.togglePlay).not.toHaveBeenCalled();
  });

  it('is chosen and cancelled in the player card', async () => {
    show(<RadioPlayer />);
    const select = screen.getByLabelText('Sleep timer');
    await userEvent.selectOptions(select, '30');
    expect(screen.getByText('Stops in 30 min')).toBeInTheDocument();
    await userEvent.selectOptions(select, '0');
    expect(screen.queryByText(/Stops in/)).toBeNull();
    expect(vol()).toBe(0.8);
  });
});

describe('thank-you line', () => {
  it('waits for the first Play, but the listener count shows at any time', () => {
    stream.status = 'idle';
    const view = show(<RadioPlayer />);
    expect(screen.queryByText(/Arigatou/)).toBeNull();
    view.unmount();
    listening = 5;
    show(<RadioPlayer />);
    expect(screen.getByText(/5 listening with you/)).toBeInTheDocument();
    expect(screen.queryByText(/Arigatou/)).toBeNull(); // still before the first Play
  });

  it('reserves the line before the first Play, so the layout does not jump when the thank-you appears', () => {
    stream.status = 'idle';
    const idle = show(<RadioPlayer />);
    const line = idle.container.querySelector('p.min-h-5');
    expect(line).not.toBeNull();
    expect(line).toBeEmptyDOMElement();
    idle.unmount();
    stream.status = 'playing';
    const playing = show(<RadioPlayer />);
    expect(playing.container.querySelector('p.min-h-5')).toHaveTextContent('Arigatou for tuning in');
  });
});
