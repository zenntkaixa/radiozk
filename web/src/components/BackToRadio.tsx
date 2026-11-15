import { Link } from 'react-router';

/** The one way back to the player from the other pages (About, What's new, Page not found). */
export default function BackToRadio() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
    >
      ▶ Back to the radio
    </Link>
  );
}
