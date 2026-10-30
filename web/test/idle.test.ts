import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDataRequested, whenIdle } from '../src/idle.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('whenIdle', () => {
  it('does not run before the delay, then runs once (no idle API: straight after the delay)', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const fn = vi.fn();
    whenIdle(fn, 2000);
    vi.advanceTimersByTime(1999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('after the delay waits for an idle period, with a timeout so it cannot starve', () => {
    const ric = vi.fn();
    vi.stubGlobal('requestIdleCallback', ric);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    const fn = vi.fn();
    whenIdle(fn, 500);
    vi.advanceTimersByTime(500);
    expect(ric).toHaveBeenCalledWith(fn, { timeout: 3000 });
    expect(fn).not.toHaveBeenCalled(); // the browser decides when
  });

  it('cancelling during the delay prevents the run', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const fn = vi.fn();
    const cancel = whenIdle(fn, 1000);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancelling after the idle callback was queued cancels that too', () => {
    const cancelIdle = vi.fn();
    vi.stubGlobal('requestIdleCallback', vi.fn(() => 42));
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
    const cancel = whenIdle(vi.fn(), 100);
    vi.advanceTimersByTime(100);
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(42);
  });
});

describe('whenIdle and images', () => {
  const img = (complete: boolean) => {
    const el = document.createElement('img');
    Object.defineProperty(el, 'complete', { value: complete, configurable: true, writable: true });
    document.body.append(el);
    return el;
  };
  afterEach(() => document.body.replaceChildren());

  it('waits while an image is still loading, then runs once it has finished', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const el = img(false);
    const fn = vi.fn();
    whenIdle(fn, 1000);
    vi.advanceTimersByTime(3000);
    expect(fn).not.toHaveBeenCalled(); // delay is over, but the cover is still downloading
    Object.defineProperty(el, 'complete', { value: true });
    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up waiting for a stuck image after a while', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    img(false);
    const fn = vi.fn();
    whenIdle(fn, 1000);
    vi.advanceTimersByTime(7999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not wait when there are no images or all are loaded', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    img(true);
    const fn = vi.fn();
    whenIdle(fn, 1000);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled while waiting for an image', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    img(false);
    const fn = vi.fn();
    const cancel = whenIdle(fn, 500);
    vi.advanceTimersByTime(1000);
    cancel();
    vi.advanceTimersByTime(20000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('saveDataRequested', () => {
  it('reads navigator.connection.saveData and defaults to false', () => {
    expect(saveDataRequested()).toBe(false);
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    expect(saveDataRequested()).toBe(true);
    vi.stubGlobal('navigator', { connection: { saveData: false } });
    expect(saveDataRequested()).toBe(false);
  });
});
