import { getFile, putFile, deleteFile, listDir, GitHubApiError } from './githubApi';
import { idbGetBoard, idbPutBoard, idbDeleteBoard } from '../db/indexedDb';
import { GITHUB_TOKEN, GITHUB_CONFIGURED } from '../config';

export class ConflictError extends Error {
  constructor(remoteBoard, remoteSha) {
    super('The board changed on GitHub since it was last loaded.');
    this.name = 'ConflictError';
    this.remoteBoard = remoteBoard;
    this.remoteSha = remoteSha;
  }
}

// A truncated or non-JSON response used to surface as a raw "JSON Parse error: Unexpected EOF",
// which said nothing about what actually went wrong.
function parseBoardJson(text, id) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The saved data for board ${id} could not be read (it looks incomplete or corrupted).`);
  }
}

function boardPath(id) {
  return `boards/${id}/board.json`;
}

// Local cache row shape: { id, board, sha, dirty }

export async function loadBoard(id) {
  const cached = await idbGetBoard(id).catch(() => null);

  if (!GITHUB_CONFIGURED) {
    if (cached) return { board: cached.board, sha: cached.sha, offline: true };
    throw new Error('This app is not configured with a shared GitHub repository yet.');
  }

  try {
    const file = await getFile(boardPath(id), GITHUB_TOKEN);
    if (!file) {
      // Not on GitHub. A cache row that carries a sha was synced at some point, so the board
      // was deleted since — showing it again would resurrect a deleted board. Only local edits
      // that never reached GitHub (dirty and never synced) are worth falling back to.
      if (cached && cached.dirty && !cached.sha) {
        return { board: cached.board, sha: null, offline: true };
      }
      if (cached) await idbDeleteBoard(id).catch(() => {});
      return null;
    }
    const board = parseBoardJson(file.text, id);
    await idbPutBoard({ id, board, sha: file.sha, dirty: false });
    return { board, sha: file.sha, offline: false };
  } catch (err) {
    if (cached) return { board: cached.board, sha: cached.sha, offline: true, loadError: err };
    throw err;
  }
}

export async function cacheBoardLocally(id, board, sha) {
  await idbPutBoard({ id, board, sha, dirty: true });
}

// Attempts to save to GitHub. Throws ConflictError if the remote file changed since `knownSha`,
// or GitHubApiError for network/permission/rate-limit failures. On any failure the local
// cache still holds the latest edits (dirty:true) so nothing is lost.
export async function saveBoard(id, board, knownSha, { force = false, message, token = GITHUB_TOKEN } = {}) {
  await cacheBoardLocally(id, board, knownSha);

  if (!GITHUB_CONFIGURED) {
    throw new Error('This app is not configured with a shared GitHub repository yet.');
  }

  const remote = await getFile(boardPath(id), token);
  const remoteSha = remote?.sha;

  if (remote && knownSha && remoteSha !== knownSha && !force) {
    const remoteBoard = parseBoardJson(remote.text, id);
    throw new ConflictError(remoteBoard, remoteSha);
  }

  const text = JSON.stringify(board, null, 2);
  const commitMessage = message || `Update board "${board.name}"`;

  let result;
  try {
    result = await putFile(boardPath(id), text, { sha: remoteSha, message: commitMessage, token });
  } catch (err) {
    // GitHub answers 409/422 when the sha we sent is already stale, which happens whenever
    // someone else's save lands between our read and our write. Re-read the sha and try once
    // more instead of failing the save outright.
    if (err.status !== 409 && err.status !== 422) throw err;
    const fresh = await getFile(boardPath(id), token);
    if (fresh && knownSha && fresh.sha !== remoteSha && !force) {
      throw new ConflictError(parseBoardJson(fresh.text, id), fresh.sha);
    }
    result = await putFile(boardPath(id), text, { sha: fresh?.sha, message: commitMessage, token });
  }

  await idbPutBoard({ id, board, sha: result.sha, dirty: false });
  return { sha: result.sha };
}

// Reads a board directly from GitHub without touching the local offline cache. Used by the admin dashboard.
export async function getBoardRaw(id, token = GITHUB_TOKEN) {
  const file = await getFile(boardPath(id), token);
  if (!file) return null;
  return { board: parseBoardJson(file.text, id), sha: file.sha };
}

export async function createBoard(board, token = GITHUB_TOKEN) {
  if (!GITHUB_CONFIGURED) throw new Error('This app is not configured with a shared GitHub repository yet.');
  const result = await putFile(boardPath(board.id), JSON.stringify(board, null, 2), {
    message: `Create board "${board.name}"`,
    token,
  });
  await idbPutBoard({ id: board.id, board, sha: result.sha, dirty: false });
  return { sha: result.sha };
}

export async function deleteBoard(id, token = GITHUB_TOKEN) {
  if (!GITHUB_CONFIGURED) throw new Error('This app is not configured with a shared GitHub repository yet.');
  const remote = await getFile(boardPath(id), token);
  if (remote) {
    try {
      await deleteFile(boardPath(id), remote.sha, `Delete board ${id}`, token);
    } catch (err) {
      // A sha that GitHub considers stale (409/422) means the file moved on since we read it,
      // so re-read it and delete the current version rather than reporting a failure.
      if (err.status !== 409 && err.status !== 422) throw err;
      const fresh = await getFile(boardPath(id), token);
      if (fresh) await deleteFile(boardPath(id), fresh.sha, `Delete board ${id}`, token);
    }
  }
  await idbDeleteBoard(id).catch(() => {});
}

// For the admin dashboard: lists every board in the repo with lightweight metadata.
export async function listBoardSummaries(token = GITHUB_TOKEN) {
  if (!GITHUB_CONFIGURED) throw new Error('This app is not configured with a shared GitHub repository yet.');
  const entries = await listDir('boards', token);
  const dirs = entries.filter((e) => e.type === 'dir');
  const summaries = [];
  for (const dir of dirs) {
    try {
      const file = await getFile(boardPath(dir.name), token);
      if (!file) continue;
      const board = parseBoardJson(file.text, dir.name);
      const activity = board.activity || [];
      const collaborators = [...new Set(activity.map((a) => a.name))];
      summaries.push({
        id: board.id,
        name: board.name,
        itemCount: board.items?.length || 0,
        updatedAt: board.updatedAt,
        lastActivity: activity[activity.length - 1] || null,
        collaborators,
        activity,
      });
    } catch (err) {
      summaries.push({ id: dir.name, name: dir.name, error: err.message });
    }
  }
  return summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export { GitHubApiError };
