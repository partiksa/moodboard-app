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
      // Not on GitHub. Fall back to a local unsynced copy if one exists, otherwise it's an invalid link.
      if (cached) return { board: cached.board, sha: cached.sha, offline: true };
      return null;
    }
    const board = JSON.parse(file.text);
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
    const remoteBoard = JSON.parse(remote.text);
    throw new ConflictError(remoteBoard, remoteSha);
  }

  const result = await putFile(boardPath(id), JSON.stringify(board, null, 2), {
    sha: remoteSha,
    message: message || `Update board "${board.name}"`,
    token,
  });

  await idbPutBoard({ id, board, sha: result.sha, dirty: false });
  return { sha: result.sha };
}

// Reads a board directly from GitHub without touching the local offline cache. Used by the admin dashboard.
export async function getBoardRaw(id, token = GITHUB_TOKEN) {
  const file = await getFile(boardPath(id), token);
  if (!file) return null;
  return { board: JSON.parse(file.text), sha: file.sha };
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
  if (remote) await deleteFile(boardPath(id), remote.sha, `Delete board ${id}`, token);
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
      const board = JSON.parse(file.text);
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
