import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESENCE_MS, usePresence } from '../src/hooks/usePresence.ts';

const reply = (listening: number) => ({ ok: true, status: 200, json: async () => ({ listening }) }) as Response;
const methods = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method ?? 'GET');
const hide = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('usePresence', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockResolvedValue(reply(4));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    hide(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('only reads the count while not playing, and polls every 30 s', async () => {
    const { result } = renderHook(() => usePresence(false));
    await act(async () => {});
    expect(result.current).toBe(4);
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(methods(fetchMock)).toEqual(['GET', 'GET']);
  });

  it('sends heartbeats every 30 s while playing, and stops when playback stops', async () => {
    const { rerender } = renderHook(({ playing }) => usePresence(playing), { initialProps: { playing: true } });
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(methods(fetchMock)).toEqual(['POST', 'POST']);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toHaveProperty('x-listener-id');
    rerender({ playing: false });
    await act(async () => {});
    fetchMock.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(methods(fetchMock)).toEqual(['GET']); // no more heartbeats
  });

  it('does not send an extra heartbeat when the status flaps within 30 s', async () => {
    const { rerender } = renderHook(({ playing }) => usePresence(playing), { initialProps: { playing: true } });
    await act(async () => {});
    for (let i = 0; i < 3; i++) {
      await act(() => vi.advanceTimersByTimeAsync(2_000));
      rerender({ playing: false });
      await act(() => vi.advanceTimersByTimeAsync(1));
      rerender({ playing: true });
      await act(() => vi.advanceTimersByTimeAsync(1));
    }
    expect(methods(fetchMock).filter((m) => m === 'POST')).toEqual(['POST']); // still just the first one
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(methods(fetchMock).filter((m) => m === 'POST')).toHaveLength(2); // the next one is due 30 s after the first
  });

  it('stops reading while the tab is hidden, but keeps sending heartbeats while playing', async () => {
    const reader = renderHook(() => usePresence(false));
    await act(async () => {});
    hide(true);
    fetchMock.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS * 2));
    expect(fetchMock).not.toHaveBeenCalled();
    reader.unmount();

    hide(false);
    renderHook(() => usePresence(true));
    await act(async () => {});
    hide(true);
    fetchMock.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(methods(fetchMock)).toEqual(['POST']);
  });

  it('keeps the last count when a request fails', async () => {
    const { result } = renderHook(() => usePresence(false));
    await act(async () => {});
    fetchMock.mockRejectedValue(new Error('offline'));
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_MS));
    expect(result.current).toBe(4);
  });
});
