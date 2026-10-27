import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';
import NotFound from './pages/NotFound.tsx';

// hls.js is large; only load it when the Radio page is visited
const Radio = lazy(() => import('./pages/Radio.tsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="radio" element={<Suspense fallback={<p>Loading…</p>}><Radio /></Suspense>} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
