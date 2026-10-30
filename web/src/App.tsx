import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
import About from './pages/About.tsx';
import NotFound from './pages/NotFound.tsx';
import Radio from './pages/Radio.tsx';

// Radio is the landing page, so it is part of the main bundle (lazy-loading it only added a request hop).
// The heavy part, hls.js, is loaded on demand by useRadioStream.

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Radio />} />
        <Route path="radio" element={<Navigate to="/" replace />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
