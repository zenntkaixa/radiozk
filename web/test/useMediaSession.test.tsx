import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaSession } from '../src/hooks/useMediaSession.ts';
import type { NowPlaying } from '../src/nowPlaying.ts';

const track = (title: string) => ({ title, artist: 'A', album: 'Al', coverUrl: `https://cdn.test/cover.jpg?t=${title}` }) as NowPlaying;

class FakeMediaMetadata {
  constructor(public init: { title: string; artwork: { src: string }[] }) {}
}

beforeEach(() => {
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata);
  Object.defineProperty(navigator, 'mediaSession', { value: { metadata: null }, configurable: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaSession');
});

const metadata = () => (navigator.mediaSession as unknown as { metadata: FakeMediaMetadata | null }).metadata;

describe('useMediaSession', () => {
  it('does not touch the media session (and so does not fetch artwork) until playback has started', () => {
    renderHook(() => useMediaSession(track('One'), false));
    expect(metadata()).toBeNull();
  });

  it('sets the metadata once active, including the artwork', () => {
    renderHook(() => useMediaSession(track('One'), true));
    expect(metadata()?.init.title).toBe('One');
    expect(metadata()?.init.artwork).toEqual([{ src: 'https://cdn.test/cover.jpg?t=One' }]);
  });

  it('sets it when it becomes active, and follows track changes afterwards', () => {
    const { rerender } = renderHook(({ t, a }) => useMediaSession(t, a), { initialProps: { t: track('One'), a: false } });
    expect(metadata()).toBeNull();
    rerender({ t: track('One'), a: true });
    expect(metadata()?.init.title).toBe('One');
    rerender({ t: track('Two'), a: true });
    expect(metadata()?.init.title).toBe('Two');
  });

  it('keeps the metadata after being deactivated (a paused player keeps its lock-screen card)', () => {
    const { rerender } = renderHook(({ a }) => useMediaSession(track('One'), a), { initialProps: { a: true } });
    rerender({ a: false });
    expect(metadata()?.init.title).toBe('One');
  });

  it('is a no-op in browsers without the Media Session API', () => {
    Reflect.deleteProperty(navigator, 'mediaSession');
    expect(() => renderHook(() => useMediaSession(track('One'), true))).not.toThrow();
  });

  it('shows a generic entry with no artwork while the track is unknown', () => {
    renderHook(() => useMediaSession(null, true));
    expect(metadata()?.init.title).toBe('radiozk live');
    expect(metadata()?.init.artwork).toEqual([]);
  });
});
