import { getListenerId } from './listenerId.ts';

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

export const getRatings = (artist: string, title: string) =>
  request<RatingSummary>(`/api/ratings?${new URLSearchParams({ artist, title })}`, {
    headers: { 'x-listener-id': getListenerId() },
  });

export const setRating = (artist: string, title: string, value: -1 | 0 | 1) =>
  request<RatingSummary>('/api/ratings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-listener-id': getListenerId() },
    body: JSON.stringify({ artist, title, value }),
  });
