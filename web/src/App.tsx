import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
import About from './pages/About.tsx';
import NotFound from './pages/NotFound.tsx';

// hls.js is large; keep it out of the main bundle so pages that don't play audio (e.g. /about) skip it
const Radio = lazy(() => import('./pages/Radio.tsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Suspense fallback={<p>Loading…</p>}><Radio /></Suspense>} />
        <Route path="radio" element={<Navigate to="/" replace />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
