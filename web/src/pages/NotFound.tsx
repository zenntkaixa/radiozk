import { Link } from 'react-router';
import { useDocumentTitle } from '../pageTitle.ts';

export default function NotFound() {
  useDocumentTitle('Page not found · radiozk');
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">📻 Nothing but static on this frequency.</p>
      <p className="mt-1 text-slate-600 dark:text-slate-400">The page you were looking for isn't here, but the music is.</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
      >
        ▶ Back to the radio
      </Link>
    </>
  );
}
