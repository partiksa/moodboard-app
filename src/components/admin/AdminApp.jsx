import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSession,
  getAdminToken,
  signInWithKey,
  verifySession,
  signOutAdmin,
  adminConfigured,
  sessionInviteUrl,
  getAdminName,
  setAdminName,
} from '../../lib/adminAuth';
import { loadWorkspaces } from '../../lib/workspaces';
import AdminAccounts from './AdminAccounts';
import { listBoardSummaries, createBoard, deleteBoard, getBoardRaw, saveBoard } from '../../lib/boardSync';
import { createEmptyBoard } from '../../state/boardModel';
import { importBoardFromFile } from '../../db/storage';
import { uid } from '../../utils/id';
import { navigate, boardShareUrl } from '../../lib/hashRoute';
import { formatActivityEntry } from '../../lib/activity';
import { GITHUB_CONFIGURED } from '../../config';
import { copyText } from '../../utils/clipboard';
import './AdminApp.css';

export default function AdminApp({ inviteKey = '' }) {
  const [session, setSession] = useState(() => getSession());
  const token = session ? getAdminToken() : '';
  const [keyDraft, setKeyDraft] = useState('');
  const [keyState, setKeyState] = useState(inviteKey ? 'checking' : 'idle'); // idle | checking | rejected
  const [workspaces, setWorkspaces] = useState([]);
  const [name, setName] = useState(() => getAdminName());
  const [nameDraft, setNameDraft] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
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

  const isOwner = session?.kind === 'owner';

  const refresh = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    setError(null);
    try {
      // a reset or deleted invite link signs this browser out on the next load
      const fresh = await verifySession();
      if (!fresh) {
        setSession(null);
        setBoards([]);
        setStatus('idle');
        setError('This invite link is no longer valid. Ask for a new one.');
        return;
      }
      const [list, reg] = await Promise.all([
        listBoardSummaries(token),
        fresh.kind === 'owner' ? loadWorkspaces(token) : Promise.resolve(null),
      ]);
      setBoards(fresh.kind === 'owner' ? list : list.filter((b) => b.workspaceId === fresh.id));
      if (reg) setWorkspaces(reg.registry.workspaces);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // an invite link signs the browser in on arrival; the key is then dropped from the URL
  useEffect(() => {
    if (!inviteKey) return;
    let cancelled = false;
    signInWithKey(inviteKey)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setKeyState(s ? 'idle' : 'rejected');
      })
      .catch((err) => {
        if (cancelled) return;
        setKeyState('rejected');
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) navigate('/admin');
      });
    return () => { cancelled = true; };
  }, [inviteKey]);

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

  const signIn = async () => {
    if (!keyDraft.trim() || keyState === 'checking') return;
    setKeyState('checking');
    setError(null);
    try {
      const s = await signInWithKey(keyDraft);
      setSession(s);
      setKeyState(s ? 'idle' : 'rejected');
      if (s) setKeyDraft('');
    } catch (err) {
      setKeyState('rejected');
      setError(err.message);
    }
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setAdminName(trimmed);
    setName(trimmed);
  };

  const copyInvite = async () => {
    const url = sessionInviteUrl(session);
    const ok = await copyText(url);
    if (ok) {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1400);
    } else {
      setError(`Could not reach the clipboard. The invite link is: ${url}`);
    }
  };

  const signOut = () => {
    signOutAdmin();
    setSession(null);
    setBoards([]);
    setError(null);
    setStatus('idle');
  };

  const handleCreate = () => {
    const name = prompt('New board name:')?.trim();
    if (!name) return;
    run('global', async () => {
      const board = { ...createEmptyBoard(name), id: uid('b'), ...(isOwner ? {} : { workspaceId: session.id }) };
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
      const clone = { ...raw.board, id: uid('b'), name: `${raw.board.name} copy`, ...(isOwner ? {} : { workspaceId: session.id }) };
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
      const imported = { ...board, id: uid('b'), name: board.name || 'Imported board', ...(isOwner ? {} : { workspaceId: session.id }) };
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

  if (!session) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <span className="dialog-eyebrow">Admin</span>
          <h2>Invite link needed</h2>
          {adminConfigured() ? (
            <>
              <p className="admin-note">
                The admin dashboard opens from an invite link. Ask whoever runs this moodboard
                for theirs, or paste the link (or just its key) below. Once accepted, this
                browser stays signed in.
              </p>
              <input
                className="admin-input"
                type="text"
                placeholder="Paste the invite link…"
                value={keyDraft}
                onChange={(e) => { setKeyDraft(e.target.value); setKeyState('idle'); }}
                onKeyDown={(e) => e.key === 'Enter' && signIn()}
                autoFocus
              />
              {keyState === 'rejected' && <p className="admin-error">{error || 'That link isn\u2019t valid for this moodboard.'}</p>}
              {keyState !== 'rejected' && error && <p className="admin-error">{error}</p>}
              <button className="admin-btn" onClick={signIn} disabled={!keyDraft.trim() || keyState === 'checking'}>
                {keyState === 'checking' ? 'Checking…' : 'Sign in'}
              </button>
            </>
          ) : (
            <p className="admin-note">
              This build has no <code>VITE_ADMIN_KEY</code> configured, so no invite link can work.
              See README.md.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <span className="dialog-eyebrow">Welcome</span>
          <h2>What should we call you?</h2>
          <p className="admin-note">
            Your name is shown next to the boards and files you change, so the others know who
            did what. You can change it later from any board.
          </p>
          <input
            className="admin-input"
            type="text"
            placeholder="Your name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            autoFocus
          />
          <button className="admin-btn" onClick={saveName} disabled={!nameDraft.trim()}>Continue</button>
        </div>
      </div>
    );
  }

  const busy = busyId !== null;
  const visibleBoards = boards.filter((b) => !deletedIds.has(b.id));

  return (
    <div className="admin-dashboard">
      <div className="admin-topbar">
        <div>
          <span className="dialog-eyebrow">{isOwner ? 'Owner' : 'Account'}</span>
          <h2>{isOwner ? 'Admin dashboard' : session.name}</h2>
        </div>
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
          <button className="admin-btn ghost" onClick={copyInvite}>
            {inviteCopied ? 'Invite link copied' : 'Copy invite link'}
          </button>
          <button className="admin-btn ghost" onClick={signOut} title={`Signed in as ${name}`}>Sign out</button>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {notice && <p className="admin-note">{notice}</p>}
      {status === 'loading' && <p className="admin-note">Loading boards…</p>}

      {isOwner && (
        <AdminAccounts
          workspaces={workspaces}
          boards={visibleBoards}
          token={token}
          run={run}
          busy={busy}
          onError={setError}
        />
      )}

      {isOwner && <div className="admin-section-head"><h3>Boards</h3></div>}
      <div className="admin-board-list">
        {visibleBoards.map((b) => {
          const rowBusy = busyId === b.id;
          const owner = b.workspaceId ? workspaces.find((w) => w.id === b.workspaceId) : null;
          const ownerLabel = !isOwner ? null : b.workspaceId ? (owner?.name || 'Unassigned') : 'Mine';
          return (
            <div key={b.id} className="admin-board-row">
              <div className="admin-board-main">
                <div className="admin-board-name">
                  {b.name}
                  {ownerLabel && <span className="admin-owner-tag">{ownerLabel}</span>}
                </div>
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
                <button onClick={() => navigate(`/admin/files/${b.id}`)}>Files</button>
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
