import { beforeEach, describe, expect, it, vi } from 'vitest';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The module caches a fallback id at module level, so load a fresh copy per test.
async function load() {
  vi.resetModules();
  return (await import('../src/listenerId.ts')).getListenerId;
}

beforeEach(() => localStorage.clear());

describe('getListenerId', () => {
  it('generates a UUID and stores it', async () => {
    const getListenerId = await load();
    const id = getListenerId();
    expect(id).toMatch(UUID);
    expect(localStorage.getItem('listenerId')).toBe(id);
  });

  it('returns the stored id on later calls and after a reload', async () => {
    const first = (await load())();
    expect((await load())()).toBe(first);
  });

  it('reuses an id that is already in storage', async () => {
    localStorage.setItem('listenerId', 'existing-id');
    expect((await load())()).toBe('existing-id');
  });

  it('falls back to a stable per-page-load id when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const getListenerId = await load();
    const id = getListenerId();
    expect(id).toMatch(UUID);
    expect(getListenerId()).toBe(id);
  });

  it('still produces a UUID without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const id = (await load())();
    vi.unstubAllGlobals();
    expect(id).toMatch(UUID);
  });
});
