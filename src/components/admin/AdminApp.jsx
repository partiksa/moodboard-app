import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken } from '../../lib/adminAuth';
import { listBoardSummaries, createBoard, deleteBoard, getBoardRaw, saveBoard } from '../../lib/boardSync';
import { createEmptyBoard } from '../../state/boardModel';
import { importBoardFromFile } from '../../db/storage';
import { uid } from '../../utils/id';
import { navigate, boardShareUrl } from '../../lib/hashRoute';
import { formatActivityEntry } from '../../lib/activity';
import { GITHUB_CONFIGURED } from '../../config';
import './AdminApp.css';

export default function AdminApp() {
  const [token, setToken] = useState(() => getAdminToken());
  const [tokenDraft, setTokenDraft] = useState('');
  const [boards, setBoards] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const importInputRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    setError(null);
    try {
      const list = await listBoardSummaries(token);
      setBoards(list);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = () => {
    if (!tokenDraft.trim()) return;
    setAdminToken(tokenDraft);
    setToken(tokenDraft.trim());
    setTokenDraft('');
  };

  const signOut = () => {
    clearAdminToken();
    setToken('');
    setBoards([]);
  };

  const handleCreate = async () => {
    const name = prompt('New board name:');
    if (!name) return;
    const board = { ...createEmptyBoard(name), id: uid('b') };
    try {
      await createBoard(board, token);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRename = async (id, currentName) => {
    const name = prompt('Rename board:', currentName);
    if (!name || name === currentName) return;
    try {
      const raw = await getBoardRaw(id, token);
      if (!raw) throw new Error('Board not found on GitHub.');
      await saveBoard(id, { ...raw.board, name }, raw.sha, { token, message: `Rename board to "${name}"` });
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const raw = await getBoardRaw(id, token);
      if (!raw) throw new Error('Board not found on GitHub.');
      const clone = { ...raw.board, id: uid('b'), name: `${raw.board.name} copy` };
      await createBoard(clone, token);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete board "${name}"? This cannot be undone.`)) return;
    try {
      await deleteBoard(id, token);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyLink = (id) => {
    navigator.clipboard?.writeText(boardShareUrl(id)).catch(() => {});
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const board = await importBoardFromFile(file);
      await createBoard({ ...board, id: uid('b') }, token);
      refresh();
    } catch (err) {
      alert(err.message || 'Import failed.');
    }
  };

  if (!GITHUB_CONFIGURED) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <h2>Admin dashboard</h2>
          <p>This build isn&rsquo;t configured with a shared GitHub repository. See README.md.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <h2>Admin sign-in</h2>
          <p className="admin-note">
            Paste a GitHub personal access token with write access to this repository. It is
            stored only in this browser&rsquo;s local storage and is never sent anywhere except
            directly to the GitHub API. This is a convenience check, not strong security &mdash;
            anyone who can access this browser profile can also see and use it.
          </p>
          <input
            className="admin-input"
            type="password"
            placeholder="ghp_..."
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && signIn()}
          />
          <button className="admin-btn" onClick={signIn}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <h2>Admin dashboard</h2>
        <div>
          <button className="admin-btn" onClick={handleCreate}>New board</button>
          <button className="admin-btn ghost" onClick={() => importInputRef.current?.click()}>Import backup…</button>
          <input
            type="file"
            accept="application/json,.json"
            ref={importInputRef}
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button className="admin-btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {status === 'error' && <p className="admin-error">{error}</p>}
      {status === 'loading' && <p className="admin-note">Loading boards…</p>}

      <div className="admin-board-list">
        {boards.map((b) => (
          <div key={b.id} className="admin-board-row">
            <div className="admin-board-main">
              <div className="admin-board-name">{b.name}</div>
              <div className="admin-board-meta">
                {b.itemCount} item(s) &middot; updated {b.updatedAt ? new Date(b.updatedAt).toLocaleString() : '—'}
                {b.lastActivity && ` · last change by ${b.lastActivity.name}`}
              </div>
              <div className="admin-board-meta">Collaborators: {b.collaborators?.length ? b.collaborators.join(', ') : '—'}</div>
            </div>
            <div className="admin-board-actions">
              <button onClick={() => navigate(`/b/${b.id}`)}>Open</button>
              <button onClick={() => copyLink(b.id)}>Copy link</button>
              <button onClick={() => handleRename(b.id, b.name)}>Rename</button>
              <button onClick={() => handleDuplicate(b.id)}>Duplicate</button>
              <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>Activity</button>
              <button className="danger" onClick={() => handleDelete(b.id, b.name)}>Delete</button>
            </div>
            {expandedId === b.id && (
              <div className="admin-activity-list">
                {(b.activity || []).length === 0 && <p className="admin-note">No activity yet.</p>}
                {[...(b.activity || [])].reverse().map((entry) => (
                  <div key={entry.id} className="admin-activity-row">
                    <strong>{entry.name}</strong> {formatActivityEntry(entry)}
                    <span className="admin-activity-time"> &middot; {new Date(entry.ts).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {status === 'idle' && boards.length === 0 && <p className="admin-note">No boards yet.</p>}
      </div>
    </div>
  );
}
