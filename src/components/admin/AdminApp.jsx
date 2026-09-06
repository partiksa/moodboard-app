import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken } from '../../lib/adminAuth';
import { listBoardSummaries, createBoard, deleteBoard, getBoardRaw, saveBoard } from '../../lib/boardSync';
import { createEmptyBoard } from '../../state/boardModel';
import { importBoardFromFile } from '../../db/storage';
import { uid } from '../../utils/id';
import { navigate, boardShareUrl } from '../../lib/hashRoute';
import { formatActivityEntry } from '../../lib/activity';
import { GITHUB_CONFIGURED } from '../../config';
import { copyText } from '../../utils/clipboard';
import './AdminApp.css';

export default function AdminApp() {
  const [token, setToken] = useState(() => getAdminToken());
  const [tokenDraft, setTokenDraft] = useState('');
  const [boards, setBoards] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [busyId, setBusyId] = useState(null); // id of the board (or 'global') with an action in flight
  const [notice, setNotice] = useState(null);
  // ids deleted in this session: GitHub's listing can lag a moment behind the delete, and a
  // row reappearing would read as "delete didn't work"
  const [deletedIds, setDeletedIds] = useState(() => new Set());
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

  // Every mutating action goes through here, so none of them can fail without saying why and
  // none of them can be fired twice by an impatient second click.
  const run = useCallback(
    async (id, fn) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      setNotice(null);
      try {
        const message = await fn();
        if (message) setNotice(message);
        await refresh();
      } catch (err) {
        setError(err.message || 'Something went wrong.');
        setStatus('error');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, refresh]
  );

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
    setError(null);
    setStatus('idle');
  };

  const handleCreate = () => {
    const name = prompt('New board name:')?.trim();
    if (!name) return;
    run('global', async () => {
      const board = { ...createEmptyBoard(name), id: uid('b') };
      await createBoard(board, token);
      return `Created "${name}".`;
    });
  };

  const handleRename = (id, currentName) => {
    const name = prompt('Rename board:', currentName)?.trim();
    if (!name || name === currentName) return;
    run(id, async () => {
      const raw = await getBoardRaw(id, token);
      if (!raw) throw new Error('That board no longer exists on GitHub.');
      await saveBoard(id, { ...raw.board, name }, raw.sha, { token, message: `Rename board to "${name}"` });
      return `Renamed to "${name}".`;
    });
  };

  const handleDuplicate = (id) => {
    run(id, async () => {
      const raw = await getBoardRaw(id, token);
      if (!raw) throw new Error('That board no longer exists on GitHub.');
      const clone = { ...raw.board, id: uid('b'), name: `${raw.board.name} copy` };
      await createBoard(clone, token);
      return `Duplicated as "${clone.name}".`;
    });
  };

  const handleDelete = (id, name) => {
    if (!confirm(`Delete board "${name}"? This cannot be undone.`)) return;
    run(id, async () => {
      await deleteBoard(id, token);
      setDeletedIds((prev) => new Set(prev).add(id));
      return `Deleted "${name}".`;
    });
  };

  const copyLink = async (id) => {
    const url = boardShareUrl(id);
    const ok = await copyText(url);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1200);
    } else {
      setError(`Could not reach the clipboard. The link is: ${url}`);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('global', async () => {
      const board = await importBoardFromFile(file);
      const imported = { ...board, id: uid('b'), name: board.name || 'Imported board' };
      await createBoard(imported, token);
      return `Imported "${imported.name}".`;
    });
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
          <button className="admin-btn" onClick={signIn} disabled={!tokenDraft.trim()}>Sign in</button>
        </div>
      </div>
    );
  }

  const busy = busyId !== null;
  const visibleBoards = boards.filter((b) => !deletedIds.has(b.id));

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <h2>Admin dashboard</h2>
        <div>
          <button className="admin-btn" onClick={handleCreate} disabled={busy}>New board</button>
          <button
            className="admin-btn ghost"
            onClick={() => importInputRef.current?.click()}
            disabled={busy}
          >
            Import backup…
          </button>
          <input
            type="file"
            accept="application/json,.json"
            ref={importInputRef}
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button className="admin-btn ghost" onClick={refresh} disabled={busy}>Refresh</button>
          <button className="admin-btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {notice && <p className="admin-note">{notice}</p>}
      {status === 'loading' && <p className="admin-note">Loading boards…</p>}

      <div className="admin-board-list">
        {visibleBoards.map((b) => {
          const rowBusy = busyId === b.id;
          return (
            <div key={b.id} className="admin-board-row">
              <div className="admin-board-main">
                <div className="admin-board-name">{b.name}</div>
                {b.error ? (
                  <div className="admin-board-meta admin-board-broken">
                    This board&rsquo;s data could not be read: {b.error}
                  </div>
                ) : (
                  <>
                    <div className="admin-board-meta">
                      {b.itemCount ?? 0} item(s) &middot; updated{' '}
                      {b.updatedAt ? new Date(b.updatedAt).toLocaleString() : '—'}
                      {b.lastActivity && ` · last change by ${b.lastActivity.name}`}
                    </div>
                    <div className="admin-board-meta">
                      Collaborators: {b.collaborators?.length ? b.collaborators.join(', ') : '—'}
                    </div>
                  </>
                )}
              </div>
              <div className="admin-board-actions">
                <button onClick={() => navigate(`/b/${b.id}`)}>Open</button>
                <button
                  className={`copy-link-btn${copiedId === b.id ? ' copied' : ''}`}
                  onClick={() => copyLink(b.id)}
                >
                  {copiedId === b.id ? 'Copied!' : 'Copy link'}
                </button>
                <button onClick={() => handleRename(b.id, b.name)} disabled={busy || b.error}>
                  Rename
                </button>
                <button onClick={() => handleDuplicate(b.id)} disabled={busy || b.error}>
                  Duplicate
                </button>
                <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                  {expandedId === b.id ? 'Hide activity' : 'Activity'}
                </button>
                <button className="danger" onClick={() => handleDelete(b.id, b.name)} disabled={busy}>
                  {rowBusy ? 'Working…' : 'Delete'}
                </button>
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
          );
        })}
        {status === 'idle' && visibleBoards.length === 0 && <p className="admin-note">No boards yet.</p>}
      </div>
    </div>
  );
}
