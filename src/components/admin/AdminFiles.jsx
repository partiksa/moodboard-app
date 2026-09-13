import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminToken } from '../../lib/adminAuth';
import { getBoardRaw } from '../../lib/boardSync';
import {
  loadFileIndex,
  addCategory,
  renameCategory,
  deleteCategory,
  moveCategory,
  moveFile,
  uploadBoardFile,
  deleteBoardFile,
  downloadAllAsZip,
  formatBytes,
  MAX_FILE_BYTES,
} from '../../lib/boardFiles';
import { navigate } from '../../lib/hashRoute';
import { GITHUB_CONFIGURED } from '../../config';
import { uid } from '../../utils/id';
import {
  ArrowLeft,
  Plus,
  PencilSimple,
  TrashSimple,
  UploadSimple,
  DownloadSimple,
  CaretUp,
  CaretDown,
  Check,
  X,
  WarningCircle,
} from '../icons.jsx';
import FileCard from '../files/FileCard.jsx';
import '../files/FilesPanel.css';
import './AdminApp.css';
import './AdminFiles.css';

const EMPTY = [];

// Admin-only library manager for one board: categories are free-form (whatever the project
// needs), files are uploaded into them and can be moved or deleted. Everything writes to the
// `files` branch through the admin token.
export default function AdminFiles({ boardId }) {
  const token = getAdminToken();
  const [boardName, setBoardName] = useState('');
  const [index, setIndex] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [busy, setBusy] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null); // { id, name }
  const [uploads, setUploads] = useState([]); // { id, name, size, progress, status, error }
  const [dragOver, setDragOver] = useState(false);
  const [zipState, setZipState] = useState({ running: false, progress: 0 });
  const inputRef = useRef(null);
  const uploadQueue = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const { index: idx } = await loadFileIndex(boardId, token);
    setIndex(idx);
  }, [boardId, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [raw] = await Promise.all([getBoardRaw(boardId, token), refresh()]);
        if (cancelled) return;
        setBoardName(raw?.board?.name || boardId);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [boardId, token, refresh]);

  // Every index mutation goes through here: one at a time, errors surfaced, list refreshed.
  const run = useCallback(async (fn) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) setIndex(next);
      else await refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
      setBusyFileId(null);
    }
  }, [busy, refresh]);

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
  const activeCategory = categories.find((c) => c.id === activeCat) || null;

  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    setNewCatName('');
    run(() => addCategory(boardId, name, token));
  };

  const commitRename = () => {
    if (!editingCat) return;
    const { id, name } = editingCat;
    setEditingCat(null);
    const trimmed = name.trim();
    const current = categories.find((c) => c.id === id);
    if (!trimmed || !current || trimmed === current.name) return;
    run(() => renameCategory(boardId, id, trimmed, token));
  };

  const handleDeleteCategory = (cat) => {
    const n = files.filter((f) => f.categoryId === cat.id).length;
    const note = n ? ` Its ${n} file(s) stay in the library under "Other".` : '';
    if (!confirm(`Delete category "${cat.name}"?${note}`)) return;
    if (activeCat === cat.id) setActiveCat('all');
    run(() => deleteCategory(boardId, cat.id, token));
  };

  const handleDeleteFile = (file) => {
    if (!confirm(`Delete "${file.name}"? This removes it from GitHub and cannot be undone.`)) return;
    setBusyFileId(file.id);
    run(() => deleteBoardFile(boardId, file, token));
  };

  const handleMoveFile = (file, categoryId) => {
    setBusyFileId(file.id);
    run(() => moveFile(boardId, file.id, categoryId, token));
  };

  // Uploads run sequentially: each one rewrites index.json, and parallel writes would race on
  // its sha. The progress list updates independently of the `busy` flag.
  const enqueueFiles = (fileList) => {
    const targetCat = activeCategory?.id || null;
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const rows = incoming.map((f) => ({
      id: uid('u'),
      name: f.name,
      size: f.size,
      progress: 0,
      status: f.size > MAX_FILE_BYTES ? 'error' : 'queued',
      error: f.size > MAX_FILE_BYTES ? `Over the ${formatBytes(MAX_FILE_BYTES)} limit` : null,
    }));
    setUploads((u) => [...u, ...rows]);
    incoming.forEach((file, i) => {
      const row = rows[i];
      if (row.status === 'error') return;
      uploadQueue.current = uploadQueue.current.then(async () => {
        setUploads((u) => u.map((r) => (r.id === row.id ? { ...r, status: 'uploading' } : r)));
        try {
          const { index: next } = await uploadBoardFile(boardId, file, targetCat, {
            token,
            onProgress: (p) => setUploads((u) => u.map((r) => (r.id === row.id ? { ...r, progress: p } : r))),
          });
          setIndex(next);
          setUploads((u) => u.map((r) => (r.id === row.id ? { ...r, status: 'done', progress: 1 } : r)));
          setTimeout(() => setUploads((u) => u.filter((r) => r.id !== row.id)), 2500);
        } catch (err) {
          setUploads((u) => u.map((r) => (r.id === row.id ? { ...r, status: 'error', error: err.message } : r)));
        }
      });
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    enqueueFiles(e.dataTransfer.files);
  };

  const downloadAll = async () => {
    if (zipState.running || visible.length === 0) return;
    setZipState({ running: true, progress: 0 });
    try {
      const suffix = activeCat === 'all' ? '' : ` - ${activeCategory?.name || 'Other'}`;
      await downloadAllAsZip(index, visible, `${boardName}${suffix}`, {
        onProgress: (p) => setZipState({ running: true, progress: p }),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setZipState({ running: false, progress: 0 });
    }
  };

  if (!GITHUB_CONFIGURED || !token) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <h2>Files</h2>
          <p className="admin-note">Sign in on the admin dashboard first.</p>
          <button className="admin-btn" onClick={() => navigate('/admin')}>Go to admin</button>
        </div>
      </div>
    );
  }

  const uploading = uploads.some((u) => u.status === 'uploading' || u.status === 'queued');

  return (
    <div className="admin-dashboard admin-files">
      <button type="button" className="admin-back" onClick={() => navigate('/admin')}>
        <ArrowLeft size={14} weight="bold" /> All boards
      </button>

      <div className="admin-topbar admin-files-top">
        <div>
          <span className="dialog-eyebrow">Files</span>
          <h2>{boardName || '…'}</h2>
          <p className="admin-note">
            {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(files.reduce((s, f) => s + (f.size || 0), 0))} · up to {formatBytes(MAX_FILE_BYTES)} per file
          </p>
        </div>
        <div className="admin-files-top-actions">
          <button className="admin-btn ghost" onClick={() => navigate(`/b/${boardId}`)}>Open board</button>
          <button className="admin-btn" onClick={downloadAll} disabled={zipState.running || visible.length === 0}>
            {zipState.running ? `Packing ${Math.round(zipState.progress * 100)}%` : 'Download ZIP'}
          </button>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {status === 'loading' && <p className="admin-note">Loading files…</p>}

      {status === 'ready' && (
        <div className="admin-files-layout">
          <aside className="admin-files-side">
            <h4>Categories</h4>
            <div className="files-rail admin-rail">
              <button type="button" className={activeCat === 'all' ? 'active' : ''} onClick={() => setActiveCat('all')}>
                <span>All files</span><em>{files.length}</em>
              </button>
              {categories.map((c, i) => (
                <div key={c.id} className={`admin-cat-row${activeCat === c.id ? ' active' : ''}`}>
                  {editingCat?.id === c.id ? (
                    <input
                      autoFocus
                      className="admin-cat-input"
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ id: c.id, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingCat(null);
                      }}
                    />
                  ) : (
                    <button type="button" className={activeCat === c.id ? 'active' : ''} onClick={() => setActiveCat(c.id)}>
                      <span>{c.name}</span><em>{files.filter((f) => f.categoryId === c.id).length}</em>
                    </button>
                  )}
                  <div className="admin-cat-tools">
                    <button type="button" className="tip tip-top" data-tip="Move up" disabled={busy || i === 0} onClick={() => run(() => moveCategory(boardId, c.id, -1, token))} aria-label="Move up"><CaretUp size={11} weight="bold" /></button>
                    <button type="button" className="tip tip-top" data-tip="Move down" disabled={busy || i === categories.length - 1} onClick={() => run(() => moveCategory(boardId, c.id, 1, token))} aria-label="Move down"><CaretDown size={11} weight="bold" /></button>
                    <button type="button" className="tip tip-top" data-tip="Rename" disabled={busy} onClick={() => setEditingCat({ id: c.id, name: c.name })} aria-label="Rename category"><PencilSimple size={12} weight="bold" /></button>
                    <button type="button" className="tip tip-top danger" data-tip="Delete category" disabled={busy} onClick={() => handleDeleteCategory(c)} aria-label="Delete category"><TrashSimple size={12} weight="bold" /></button>
                  </div>
                </div>
              ))}
              {uncategorised.length > 0 && categories.length > 0 && (
                <button type="button" className={activeCat === 'none' ? 'active' : ''} onClick={() => setActiveCat('none')}>
                  <span>Other</span><em>{uncategorised.length}</em>
                </button>
              )}
            </div>

            <form
              className="admin-cat-add"
              onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }}
            >
              <input
                className="admin-cat-input"
                placeholder="New category…"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className="admin-cat-add-btn tip tip-top" data-tip="Add category" disabled={busy || !newCatName.trim()} aria-label="Add category">
                <Plus size={13} weight="bold" />
              </button>
            </form>
          </aside>

          <section className="admin-files-main">
            <div
              className={`admin-dropzone${dragOver ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            >
              <span className="admin-dropzone-orb"><UploadSimple size={18} weight="bold" /></span>
              <div>
                <strong>Drop files here or click to choose</strong>
                <span>
                  {activeCategory
                    ? <>Uploads go into <b>{activeCategory.name}</b>.</>
                    : categories.length === 0
                      ? 'Create a category on the left first, or upload without one.'
                      : 'Select a category on the left to upload straight into it.'}
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { enqueueFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {uploads.length > 0 && (
              <div className="admin-upload-list">
                {uploads.map((u) => (
                  <div key={u.id} className={`admin-upload-row ${u.status}`}>
                    <span className="admin-upload-name">{u.name}</span>
                    <span className="admin-upload-size">{formatBytes(u.size)}</span>
                    <span className="admin-upload-state">
                      {u.status === 'queued' && 'Waiting'}
                      {u.status === 'uploading' && `${Math.round(u.progress * 100)}%`}
                      {u.status === 'done' && <Check size={13} weight="bold" />}
                      {u.status === 'error' && <><WarningCircle size={13} weight="bold" /> {u.error}</>}
                    </span>
                    {u.status === 'error' && (
                      <button type="button" className="admin-upload-dismiss" onClick={() => setUploads((list) => list.filter((r) => r.id !== u.id))} aria-label="Dismiss">
                        <X size={11} weight="bold" />
                      </button>
                    )}
                    <span className="admin-upload-bar" style={{ transform: `scaleX(${u.status === 'done' ? 1 : u.progress})` }} />
                  </div>
                ))}
              </div>
            )}

            <div className="admin-files-grid-head">
              <h4>{activeCat === 'all' ? 'All files' : activeCat === 'none' ? 'Other' : activeCategory?.name}</h4>
              <span className="admin-note">{visible.length} file{visible.length === 1 ? '' : 's'}</span>
            </div>

            <div className="files-grid admin-files-grid">
              {visible.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  busy={busyFileId === f.id}
                  onDelete={handleDeleteFile}
                  categoryPicker={
                    <select
                      value={f.categoryId && categories.some((c) => c.id === f.categoryId) ? f.categoryId : ''}
                      onChange={(e) => handleMoveFile(f, e.target.value || null)}
                      disabled={busy}
                      aria-label="Category"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  }
                />
              ))}
              {visible.length === 0 && !uploading && (
                <div className="files-state small">
                  {files.length === 0 ? 'No files yet. Drop the first ones above.' : 'Nothing in this category.'}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <p className="admin-note admin-files-foot">
        <DownloadSimple size={12} weight="bold" /> Anyone with the board link can download these from the Files button in the toolbar.
      </p>
    </div>
  );
}
