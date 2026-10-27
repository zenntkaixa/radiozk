import { Link } from 'react-router';

export default function NotFound() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="text-indigo-600 hover:underline">Back home</Link>
    </>
  );
}
