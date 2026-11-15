import { useEffect, useState } from 'react';

const SHARE = { title: 'radiozk', text: 'Listening to a live lossless radio stream on radiozk', url: '' };

/** Opens the phone's share sheet where there is one, otherwise copies the link. Shares the site, not the track. */
export default function ShareButton() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  async function share() {
    const data = { ...SHARE, url: `${location.origin}/` };
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // closed the sheet: not an error
      // any other failure: fall through to copying
    }
    try {
      await navigator.clipboard.writeText(data.url);
      setMsg('Link copied');
    } catch {
      setMsg(`Copy this link: ${data.url}`);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="min-h-11 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:border-indigo-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 dark:border-slate-600 dark:text-slate-300"
      >
        Share
      </button>
      {msg && <span role="status" className="text-sm text-slate-500 dark:text-slate-400">{msg}</span>}
    </span>
  );
}
