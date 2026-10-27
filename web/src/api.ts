async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export interface RatingSummary {
  up: number;
  down: number;
  /** This listener's vote: 1, -1, or 0 for none. */
  mine: -1 | 0 | 1;
}

// Anonymous listener identity: a random UUID kept in the browser, one vote per track per listener.
let memoryId: string | null = null;
function listenerId(): string {
  try {
    const saved = localStorage.getItem('listenerId');
    if (saved) return saved;
  } catch {
    /* storage blocked: fall back to a per-page-load id */
  }
  if (memoryId) return memoryId;
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
          (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
        );
  memoryId = id;
  try {
    localStorage.setItem('listenerId', id);
  } catch {
    /* ignore */
  }
  return id;
}

export const getRatings = (artist: string, title: string) =>
  request<RatingSummary>(`/api/ratings?${new URLSearchParams({ artist, title })}`, {
    headers: { 'x-listener-id': listenerId() },
  });

export const setRating = (artist: string, title: string, value: -1 | 0 | 1) =>
  request<RatingSummary>('/api/ratings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-listener-id': listenerId() },
    body: JSON.stringify({ artist, title, value }),
  });
