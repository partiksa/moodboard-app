import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlers.onSave?.();
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handlers.onUndo?.();
      } else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handlers.onRedo?.();
      } else if (!isEditable && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handlers.onDelete?.();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onDuplicate?.();
      } else if (mod && e.key.toLowerCase() === 'a' && !isEditable) {
        e.preventDefault();
        handlers.onSelectAll?.();
      } else if (mod && e.key.toLowerCase() === 'g' && !isEditable) {
        e.preventDefault();
        if (e.shiftKey) handlers.onUngroup?.();
        else handlers.onGroup?.();
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handlers.onFocusSearch?.();
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handlers.onZoomIn?.();
      } else if (mod && e.key === '-') {
        e.preventDefault();
        handlers.onZoomOut?.();
      } else if (mod && e.key === '0') {
        e.preventDefault();
        handlers.onZoomReset?.();
      } else if (!isEditable && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handlers.onNudge?.(e.key, e.shiftKey ? 10 : 1);
      } else if (!isEditable && e.key === 'Escape') {
        handlers.onEscape?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
