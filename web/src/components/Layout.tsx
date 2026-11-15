import { NavLink, Outlet } from 'react-router';

const link = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <nav className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-4">
          <span className="flex items-center gap-2 text-lg font-bold">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>radio<span className="text-indigo-600 dark:text-indigo-400">zk</span></span>
          </span>
          <NavLink to="/" end className={link}>Radio</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
