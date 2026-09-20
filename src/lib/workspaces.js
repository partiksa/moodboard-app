import { getFile, putFile, GitHubApiError } from './githubApi';
import { GITHUB_TOKEN } from '../config';
import { uid } from '../utils/id';

// Every admin account is a "workspace": a name plus a random key. The key doubles as the
// invite link (#/admin?key=<key>) and as the owner label on boards (board.workspaceId).
// The registry lives in the repo next to the boards; it holds nothing secret in a
// meaningful sense, since the app's write token is public too.
const REGISTRY_PATH = 'workspaces/index.json';

function emptyRegistry() {
  return { version: 1, workspaces: [], updatedAt: null };
}

function randomKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loadWorkspaces(token = GITHUB_TOKEN) {
  const file = await getFile(REGISTRY_PATH, token);
  if (!file) return { registry: emptyRegistry(), sha: undefined };
  try {
    const parsed = JSON.parse(file.text);
    return { registry: { ...emptyRegistry(), ...parsed, workspaces: parsed.workspaces || [] }, sha: file.sha };
  } catch {
    throw new Error('The account list could not be read (it looks corrupted).');
  }
}

export async function findWorkspaceByKey(key, token = GITHUB_TOKEN) {
  if (!key) return null;
  const { registry } = await loadWorkspaces(token);
  return registry.workspaces.find((w) => w.key === key) || null;
}

export async function getWorkspace(id, token = GITHUB_TOKEN) {
  if (!id) return null;
  const { registry } = await loadWorkspaces(token);
  return registry.workspaces.find((w) => w.id === id) || null;
}

// read-modify-write with a retry when someone else saved the registry in between
async function updateRegistry(token, mutate, message) {
  let attempt = 0;
  for (;;) {
    const { registry, sha } = await loadWorkspaces(token);
    const next = mutate(structuredClone(registry));
    if (!next) return registry;
    next.updatedAt = new Date().toISOString();
    try {
      await putFile(REGISTRY_PATH, JSON.stringify(next, null, 2), { sha, message, token });
      return next;
    } catch (err) {
      const stale = err instanceof GitHubApiError && (err.status === 409 || err.status === 422);
      if (!stale || attempt++ > 1) throw err;
    }
  }
}

export async function createWorkspace(name, token = GITHUB_TOKEN) {
  const ws = { id: uid('w'), name: name.trim(), key: randomKey(), createdAt: new Date().toISOString() };
  await updateRegistry(token, (r) => {
    r.workspaces.push(ws);
    return r;
  }, `Create account "${ws.name}"`);
  return ws;
}

export function renameWorkspace(id, name, token = GITHUB_TOKEN) {
  return updateRegistry(token, (r) => {
    const ws = r.workspaces.find((w) => w.id === id);
    if (!ws) return null;
    ws.name = name.trim();
    return r;
  }, `Rename account to "${name.trim()}"`);
}

// A new key invalidates the old invite link for everyone who used it.
export async function rotateWorkspaceKey(id, token = GITHUB_TOKEN) {
  const key = randomKey();
  await updateRegistry(token, (r) => {
    const ws = r.workspaces.find((w) => w.id === id);
    if (!ws) return null;
    ws.key = key;
    return r;
  }, 'Reset account invite link');
  return key;
}

// Boards stay in the repo; they just no longer belong to anyone but the owner.
export function deleteWorkspace(id, token = GITHUB_TOKEN) {
  return updateRegistry(token, (r) => {
    const before = r.workspaces.length;
    r.workspaces = r.workspaces.filter((w) => w.id !== id);
    return r.workspaces.length === before ? null : r;
  }, 'Delete account');
}

export function workspaceInviteUrl(key) {
  return `${window.location.origin}${window.location.pathname}#/admin?key=${encodeURIComponent(key)}`;
}
