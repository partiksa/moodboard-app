import { useEffect, useMemo, useState } from 'react';
import { X, DownloadSimple, FolderSimple, WarningCircle } from '../icons.jsx';
import { loadFileIndex, downloadAllAsZip, formatBytes } from '../../lib/boardFiles';
import FileCard from './FileCard.jsx';
import './FilesPanel.css';

const EMPTY = [];

// Read-only library for everyone who has the board link. Uploads and categories are managed
// from the admin area; this panel only lists and downloads.
export default function FilesPanel({ board, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [zipState, setZipState] = useState({ running: false, progress: 0, error: null });

  useEffect(() => {
    let cancelled = false;
    loadFileIndex(board.id)
      .then(({ index: idx }) => {
        if (cancelled) return;
        setIndex(idx);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [board.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const files = index?.files || EMPTY;
  const categories = index?.categories || EMPTY;
  const uncategorised = useMemo(
    () => files.filter((f) => !f.categoryId || !categories.some((c) => c.id === f.categoryId)),
    [files, categories]
  );
  const visible = useMemo(() => {
    if (activeCat === 'all') return files;
    if (activeCat === 'none') return uncategorised;
    return files.filter((f) => f.categoryId === activeCat);
  }, [activeCat, files, uncategorised]);
  const totalBytes = visible.reduce((s, f) => s + (f.size || 0), 0);
  const activeName = activeCat === 'all' ? 'all files' : activeCat === 'none' ? 'other files' : categories.find((c) => c.id === activeCat)?.name || '';

  const downloadAll = async () => {
    if (zipState.running || visible.length === 0) return;
    setZipState({ running: true, progress: 0, error: null });
    try {
      const suffix = activeCat === 'all' ? '' : ` - ${activeName}`;
      await downloadAllAsZip(index, visible, `${board.name}${suffix}`, {
        onProgress: (p) => setZipState((s) => ({ ...s, progress: p })),
      });
      setZipState({ running: false, progress: 1, error: null });
    } catch (err) {
      setZipState({ running: false, progress: 0, error: err.message || 'The ZIP could not be built.' });
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="files-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Board files">
        <div className="settings-header files-header">
          <div>
            <span className="dialog-eyebrow">Files</span>
            <h3>{board.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={14} weight="bold" /></button>
        </div>

        {status === 'loading' && <div className="files-state">Loading files…</div>}
        {status === 'error' && (
          <div className="files-state error"><WarningCircle size={18} weight="light" /> {error}</div>
        )}

        {status === 'ready' && files.length === 0 && (
          <div className="files-state empty">
            <span className="files-empty-glyph"><FolderSimple size={34} weight="light" /></span>
            <strong>No files yet</strong>
            <span>The board owner can add originals from the admin area.</span>
          </div>
        )}

        {status === 'ready' && files.length > 0 && (
          <div className="files-body">
            <nav className="files-rail" aria-label="Categories">
              <button type="button" className={activeCat === 'all' ? 'active' : ''} onClick={() => setActiveCat('all')}>
                <span>All</span><em>{files.length}</em>
              </button>
              {categories.map((c) => {
                const n = files.filter((f) => f.categoryId === c.id).length;
                return (
                  <button key={c.id} type="button" className={activeCat === c.id ? 'active' : ''} onClick={() => setActiveCat(c.id)}>
                    <span>{c.name}</span><em>{n}</em>
                  </button>
                );
              })}
              {uncategorised.length > 0 && categories.length > 0 && (
                <button type="button" className={activeCat === 'none' ? 'active' : ''} onClick={() => setActiveCat('none')}>
                  <span>Other</span><em>{uncategorised.length}</em>
                </button>
              )}
            </nav>

            <div className="files-main">
              <div className="files-grid">
                {visible.map((f) => <FileCard key={f.id} file={f} />)}
                {visible.length === 0 && <div className="files-state small">Nothing in this category.</div>}
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && files.length > 0 && (
          <div className="files-footer">
            <span className="files-footer-meta">
              {visible.length} file{visible.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}
              {zipState.error && <span className="files-footer-error"> · {zipState.error}</span>}
            </span>
            <button type="button" className="primary-btn files-zip-btn" onClick={downloadAll} disabled={zipState.running || visible.length === 0}>
              {zipState.running ? `Packing ${Math.round(zipState.progress * 100)}%` : `Download ${activeCat === 'all' ? 'all' : activeName} as ZIP`}
              <span className="btn-orb"><DownloadSimple size={12} weight="bold" /></span>
              {zipState.running && <span className="files-zip-progress" style={{ transform: `scaleX(${zipState.progress})` }} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
