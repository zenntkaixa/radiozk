import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNowPlaying } from '../src/nowPlaying.ts';

const feed = (title: string) => ({ artist: 'Artist', title, album: 'Album', date: '2000', bit_depth: 16, sample_rate: 44100 });
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe('useNowPlaying with the early request from index.html', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    delete window.__earlyMetadata;
    vi.unstubAllGlobals();
  });

  it('uses the early result for the first poll without fetching again', async () => {
    window.__earlyMetadata = Promise.resolve(feed('Early'));
    const { result } = renderHook(() => useNowPlaying());
    await waitFor(() => expect(result.current.data?.title).toBe('Early'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__earlyMetadata).toBeUndefined(); // taken over, so a remount fetches normally
  });

  it('falls back to a normal fetch when the early request failed (null)', async () => {
    window.__earlyMetadata = Promise.resolve(null);
    fetchMock.mockResolvedValue(response(feed('Fetched')));
    const { result } = renderHook(() => useNowPlaying());
    await waitFor(() => expect(result.current.data?.title).toBe('Fetched'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches normally when there is no early request', async () => {
    fetchMock.mockResolvedValue(response(feed('Plain')));
    const { result } = renderHook(() => useNowPlaying());
    await waitFor(() => expect(result.current.data?.title).toBe('Plain'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports an error when both the early request and the fallback fail', async () => {
    window.__earlyMetadata = Promise.resolve(null);
    fetchMock.mockResolvedValue(response({}, false));
    const { result } = renderHook(() => useNowPlaying());
    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
