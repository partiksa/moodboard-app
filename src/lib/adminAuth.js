import { ADMIN_KEY, GITHUB_TOKEN } from '../config';
import { getDisplayName, setDisplayName } from './displayName';
import { findWorkspaceByKey, getWorkspace, workspaceInviteUrl } from './workspaces';

// Admin access is an invite link: "#/admin?key=<key>". The owner's key comes from the build
// (VITE_ADMIN_KEY) and sees everything; every other key belongs to a workspace (an account
// with its own boards) created by the owner. Whoever opens a link once is remembered in
// this browser and works through the shared write token, so no GitHub account or e-mail is
// needed. Keys only gate the UI (the token is public anyway); they keep dashboards apart and
// off-limits to people who merely have a board link.
const KEY = 'moodboard-admin-session';
const LEGACY_KEYS = ['moodboard-admin-token', 'moodboard-admin-key'];

export function adminConfigured() {
  return Boolean(ADMIN_KEY);
}

// { kind: 'owner' } | { kind: 'workspace', id, name, key } | null
export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.kind === 'owner') return adminConfigured() && s.key === ADMIN_KEY ? { kind: 'owner' } : null;
    if (s.kind === 'workspace' && s.id && s.key) return s;
    return null;
  } catch {
    return null;
  }
}

function store(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}

function keyFromInput(input) {
  const raw = (input || '').trim();
  const fromUrl = raw.match(/[?&]key=([^&#\s]+)/);
  return decodeURIComponent(fromUrl ? fromUrl[1] : raw);
}

// Accepts the bare key or a whole invite link. Resolves to the session, or null.
export async function signInWithKey(input) {
  const key = keyFromInput(input);
  if (!key) return null;
  if (adminConfigured() && key === ADMIN_KEY) {
    store({ kind: 'owner', key });
    return { kind: 'owner' };
  }
  const ws = await findWorkspaceByKey(key);
  if (!ws) return null;
  const session = { kind: 'workspace', id: ws.id, name: ws.name, key: ws.key };
  store(session);
  return session;
}

// A workspace session is re-checked against the registry so a reset or deleted invite link
// stops working; resolves to the fresh session or null when it no longer exists.
export async function verifySession() {
  const s = getSession();
  if (!s) return null;
  if (s.kind === 'owner') return s;
  const ws = await getWorkspace(s.id);
  if (!ws || ws.key !== s.key) {
    signOutAdmin();
    return null;
  }
  const fresh = { kind: 'workspace', id: ws.id, name: ws.name, key: ws.key };
  store(fresh);
  return fresh;
}

export function signOutAdmin() {
  localStorage.removeItem(KEY);
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}

// the token every admin action is signed with; empty when not signed in
export function getAdminToken() {
  return getSession() ? GITHUB_TOKEN : '';
}

// true when this session may manage the given board
export function canManageBoard(session, board) {
  if (!session || !board) return false;
  if (session.kind === 'owner') return true;
  return board.workspaceId === session.id;
}

export function getAdminName() {
  return getDisplayName();
}

export function setAdminName(name) {
  setDisplayName(name);
}

export function sessionInviteUrl(session) {
  if (!session) return '';
  return workspaceInviteUrl(session.kind === 'owner' ? ADMIN_KEY : session.key);
}
