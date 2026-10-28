import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRatings, setRating } from '../src/api.ts';

const fetchMock = vi.fn();
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  localStorage.setItem('listenerId', 'listener-1');
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('getRatings', () => {
  it('GETs the encoded track with the listener header', async () => {
    fetchMock.mockResolvedValue(ok({ up: 1, down: 0, mine: 1 }));
    const r = await getRatings('AC/DC', 'Back & Black');
    expect(r).toEqual({ up: 1, down: 0, mine: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ratings?artist=AC%2FDC&title=Back+%26+Black');
    expect(init.headers['x-listener-id']).toBe('listener-1');
  });
});

describe('setRating', () => {
  it('POSTs JSON with the listener header', async () => {
    fetchMock.mockResolvedValue(ok({ up: 1, down: 0, mine: 1 }));
    await setRating('A', 'T', 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ratings');
    expect(init.method).toBe('POST');
    expect(init.headers['x-listener-id']).toBe('listener-1');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ artist: 'A', title: 'T', value: 1 });
  });

  it('rejects with the server error message', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'value must be 1, -1 or 0' }), { status: 400 }));
    await expect(setRating('A', 'T', 1)).rejects.toThrow('value must be 1, -1 or 0');
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 502, statusText: 'Bad Gateway' }));
    await expect(setRating('A', 'T', 1)).rejects.toThrow('Bad Gateway');
  });
});
