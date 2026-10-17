import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PostPage } from './pages/PostPage';

/**
 * React Router handles navigation client-side, so the browser never scrolls
 * to a #hash on its own. This scrolls to the target section on hash links
 * (Writing / About) and to the top on page changes.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView();
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/writing/:slug" element={<PostPage />} />
        <Route path="/writing/:slug/" element={<PostPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
