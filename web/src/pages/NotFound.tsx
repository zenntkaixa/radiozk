import BackToRadio from '../components/BackToRadio.tsx';
import { useDocumentTitle } from '../pageTitle.ts';

export default function NotFound() {
  useDocumentTitle('Page not found · radiozk');
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">📻 Nothing but static on this frequency.</p>
      <p className="mt-1 text-slate-600 dark:text-slate-400">The page you were looking for isn't here, but the music is.</p>
      <div className="mt-6">
        <BackToRadio />
      </div>
    </>
  );
}
