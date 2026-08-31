import { useCallback, useEffect, useState } from 'react';

const KEY = 'moodboard-theme-mode';

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

export function useTheme() {
  const [mode, setModeState] = useState(() => localStorage.getItem(KEY) || 'system');

  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [mode]);

  const setMode = useCallback((next) => {
    localStorage.setItem(KEY, next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
