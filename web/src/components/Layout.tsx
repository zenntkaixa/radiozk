import { NavLink, Outlet } from 'react-router';

const link = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-indigo-600' : 'text-slate-600 hover:text-slate-900';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-4">
          <span className="text-lg font-bold">radiozk</span>
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/radio" className={link}>Radio</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
