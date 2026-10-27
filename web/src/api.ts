export interface Note {
  id: number;
  body: string;
  created_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export const listNotes = () => request<Note[]>('/api/notes');

export const addNote = (body: string) =>
  request<Note>('/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  });
