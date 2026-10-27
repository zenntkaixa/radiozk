import { useEffect, useState, type FormEvent } from 'react';
import { listNotes, addNote, type Note } from '../api.ts';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listNotes().then(setNotes).catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const note = await addNote(draft);
      setNotes((prev) => [note, ...prev]);
      setDraft('');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Notes</h1>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note"
          required
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2"
        />
        <button className="rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Add</button>
      </form>
      {error && <p className="mt-3 text-red-700">{error}</p>}
      <ul className="mt-6 space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded border border-slate-200 bg-white px-3 py-2">{n.body}</li>
        ))}
      </ul>
    </>
  );
}
