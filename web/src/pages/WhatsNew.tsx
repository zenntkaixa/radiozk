import BackToRadio from '../components/BackToRadio.tsx';
import { CHANGELOG } from '../changelog.ts';
import { useDocumentTitle } from '../pageTitle.ts';

export default function WhatsNew() {
  useDocumentTitle("What's new · radiozk");
  return (
    <>
      <h1 className="text-2xl font-bold">What's new</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">Recent changes to radiozk, newest first.</p>
      <div className="mt-6 space-y-4">
        {CHANGELOG.map((r) => (
          <section key={r.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold">{r.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400"><time dateTime={r.date}>{r.date}</time></p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-6">
        <BackToRadio />
      </div>
    </>
  );
}
