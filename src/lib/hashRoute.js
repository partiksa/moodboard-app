import { useEffect, useState } from 'react';

// Hash-based routing so GitHub Pages (static hosting, no server rewrites) never 404s.
// Recognized shapes: "#/", "#/b/<boardId>", "#/admin".
function parseHash(hash) {
  const clean = hash.replace(/^#\/?/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'b' && parts[1]) return { name: 'board', boardId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'admin') return { name: 'admin' };
  return { name: 'welcome' };
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(path) {
  window.location.hash = path;
}

export function boardShareUrl(boardId) {
  return `${window.location.origin}${window.location.pathname}#/b/${encodeURIComponent(boardId)}`;
}
