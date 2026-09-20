import { useState } from 'react';
import { createWorkspace, renameWorkspace, rotateWorkspaceKey, deleteWorkspace, workspaceInviteUrl } from '../../lib/workspaces';
import { copyText } from '../../utils/clipboard';

// Owner-only: the list of accounts (workspaces). Each one has its own invite link and sees
// only the boards it created.
export default function AdminAccounts({ workspaces, boards, token, run, busy, onError }) {
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    run('accounts', async () => {
      await createWorkspace(name, token);
      setDraft('');
      return `Created account "${name}". Copy its invite link and send it over.`;
    });
  };

  const rename = (ws) => {
    const name = prompt('Rename account:', ws.name)?.trim();
    if (!name || name === ws.name) return;
    run(ws.id, async () => {
      await renameWorkspace(ws.id, name, token);
      return `Renamed to "${name}".`;
    });
  };

  const reset = (ws) => {
    if (!confirm(`Reset the invite link for "${ws.name}"? Everyone who signed in with the old link is signed out.`)) return;
    run(ws.id, async () => {
      await rotateWorkspaceKey(ws.id, token);
      return `New invite link for "${ws.name}".`;
    });
  };

  const remove = (ws) => {
    const count = boards.filter((b) => b.workspaceId === ws.id).length;
    const tail = count ? ` Its ${count} board(s) stay in the repo and show up under "Unassigned".` : '';
    if (!confirm(`Delete account "${ws.name}"?${tail}`)) return;
    run(ws.id, async () => {
      await deleteWorkspace(ws.id, token);
      return `Deleted account "${ws.name}".`;
    });
  };

  const copyInvite = async (ws) => {
    const url = workspaceInviteUrl(ws.key);
    if (await copyText(url)) {
      setCopiedId(ws.id);
      setTimeout(() => setCopiedId((cur) => (cur === ws.id ? null : cur)), 1200);
    } else {
      onError(`Could not reach the clipboard. The invite link is: ${url}`);
    }
  };

  return (
    <section className="admin-accounts">
      <div className="admin-section-head">
        <h3>Accounts</h3>
        <span className="admin-note">Each account gets its own dashboard and boards. Send the invite link, that is the whole sign-up.</span>
      </div>
      <div className="admin-account-add">
        <input
          className="admin-input"
          type="text"
          placeholder="New account name, e.g. a client or a studio"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          disabled={busy}
        />
        <button className="admin-btn" onClick={create} disabled={busy || !draft.trim()}>Create account</button>
      </div>
      <div className="admin-account-list">
        {workspaces.map((ws) => {
          const count = boards.filter((b) => b.workspaceId === ws.id).length;
          return (
            <div key={ws.id} className="admin-account-row">
              <div className="admin-board-main">
                <div className="admin-board-name">{ws.name}</div>
                <div className="admin-board-meta">
                  {count} board(s) &middot; created {new Date(ws.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="admin-board-actions">
                <button className={`copy-link-btn${copiedId === ws.id ? ' copied' : ''}`} onClick={() => copyInvite(ws)}>
                  {copiedId === ws.id ? 'Copied!' : 'Copy invite link'}
                </button>
                <button onClick={() => rename(ws)} disabled={busy}>Rename</button>
                <button onClick={() => reset(ws)} disabled={busy}>Reset link</button>
                <button className="danger" onClick={() => remove(ws)} disabled={busy}>Delete</button>
              </div>
            </div>
          );
        })}
        {workspaces.length === 0 && <p className="admin-note">No accounts yet.</p>}
      </div>
    </section>
  );
}
