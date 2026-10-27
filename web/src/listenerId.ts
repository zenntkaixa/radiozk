// Anonymous listener identity: a random UUID kept in the browser, one vote per track per listener.
let memoryId: string | null = null;

export function getListenerId(): string {
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
