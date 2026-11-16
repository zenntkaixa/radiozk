import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { RadioProvider } from '../hooks/RadioProvider.tsx';
import MiniPlayer, { useMiniPlayerVisible } from './MiniPlayer.tsx';

const link = ({ isActive }: { isActive: boolean }) =>
  'inline-flex min-h-11 items-center px-1.5 ' + (isActive ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white');

/** Each route names itself as canonical (index.html can only say one thing for every page). Same host as og:url there. */
export const SITE = 'https://zenntkaixa-radiozk.onrender.com';
function useCanonical() {
  const { pathname } = useLocation();
  useEffect(() => {
    let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = 'canonical';
      document.head.appendChild(el);
    }
    el.href = SITE + pathname;
  }, [pathname]);
}

function Shell() {
  const mini = useMiniPlayerVisible();
  useCanonical();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <nav className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-1 sm:gap-6">
          <span className="flex items-center gap-2 text-lg font-bold">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>radio<span className="text-indigo-600 dark:text-indigo-400">zk</span></span>
          </span>
          <NavLink to="/" end className={link}>Radio</NavLink>
          <NavLink to="/liked" className={link}>Liked</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
        </nav>
      </header>
      <main className={`mx-auto max-w-2xl px-4 py-8 ${mini ? 'pb-28' : ''}`}>
        <Outlet />
      </main>
      <MiniPlayer />
    </div>
  );
}

// The provider is above the pages, so the radio keeps playing as the visitor moves between them.
export default function Layout() {
  return (
    <RadioProvider>
      <Shell />
    </RadioProvider>
  );
}
