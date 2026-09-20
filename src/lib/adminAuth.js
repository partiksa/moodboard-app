import { ADMIN_KEY, GITHUB_TOKEN } from '../config';
import { getDisplayName, setDisplayName } from './displayName';

// Admin access is an invite link: "#/admin?key=<ADMIN_KEY>". Whoever opens it once is
// remembered in this browser and works through the shared write token, so no GitHub
// account or e-mail is needed. The key only gates the UI (the token is public anyway);
// it keeps the dashboard off-limits to people who merely have a board link.
const KEY = 'moodboard-admin-key';
const LEGACY_TOKEN_KEY = 'moodboard-admin-token';

export function adminConfigured() {
  return Boolean(ADMIN_KEY);
}

export function isAdmin() {
  return adminConfigured() && localStorage.getItem(KEY) === ADMIN_KEY;
}

// accepts the bare key or a whole invite link pasted in
export function signInWithKey(input) {
  const raw = (input || '').trim();
  const fromUrl = raw.match(/[?&]key=([^&#\s]+)/);
  const key = decodeURIComponent(fromUrl ? fromUrl[1] : raw);
  if (!adminConfigured() || key !== ADMIN_KEY) return false;
  localStorage.setItem(KEY, key);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  return true;
}

export function signOutAdmin() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

// the token every admin action is signed with; empty when not signed in
export function getAdminToken() {
  return isAdmin() ? GITHUB_TOKEN : '';
}

export function getAdminName() {
  return getDisplayName();
}

export function setAdminName(name) {
  setDisplayName(name);
}

export function adminInviteUrl() {
  return `${window.location.origin}${window.location.pathname}#/admin?key=${encodeURIComponent(ADMIN_KEY)}`;
}
