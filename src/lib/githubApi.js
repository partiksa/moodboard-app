import { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } from '../config';

const API_ROOT = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function friendlyError(status, fallback) {
  if (status === 401) return new GitHubApiError('The GitHub token was rejected. It may be invalid or revoked.', status);
  if (status === 403) return new GitHubApiError('GitHub blocked this request (rate limit or missing permission on the token).', status);
  if (status === 404) return new GitHubApiError('Not found on GitHub.', status);
  if (status === 409) return new GitHubApiError('This file changed on GitHub since it was last loaded.', status);
  if (status === 422) return new GitHubApiError('GitHub rejected the request (often a stale sha or invalid content).', status);
  return new GitHubApiError(fallback || `GitHub request failed (status ${status}).`, status);
}

async function request(path, { method = 'GET', token, body } = {}) {
  let res;
  try {
    res = await fetch(`${API_ROOT}${path}`, {
      method,
      // GitHub answers authenticated GETs with `cache-control: private, max-age=60`, so the
      // browser used to replay a stale listing or a stale file sha for a minute: a deleted
      // board reappeared on refresh and saves failed on a sha that was already outdated.
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GitHubApiError('Could not reach GitHub. Check your internet connection.', 0);
  }
  if (res.status === 404) throw friendlyError(404);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message; } catch { /* ignore */ }
    throw friendlyError(res.status, detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function contentsPath(path) {
  return `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
}

// Returns { sha, text } or null if the file does not exist.
// The Contents API only inlines files up to 1 MB: above that it answers with an empty
// `content` and `encoding: "none"`, which used to decode to an empty string and blow up as
// "JSON Parse error: Unexpected EOF" further up. Anything without usable inline content is
// re-fetched through the Git blobs API, which serves files up to 100 MB.
export async function getFile(path, token, { branch = GITHUB_BRANCH } = {}) {
  try {
    const data = await request(`${contentsPath(path)}?ref=${branch}`, { token });
    if (data.encoding === 'base64' && data.content) {
      return { text: base64ToUtf8(data.content), sha: data.sha };
    }
    const blob = await request(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs/${data.sha}`, { token });
    if (blob.encoding !== 'base64' || !blob.content) {
      throw new GitHubApiError('This board file is too large for GitHub to return in one piece.', 0);
    }
    return { text: base64ToUtf8(blob.content), sha: data.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Creates or updates a file. Pass `sha` when updating an existing file (optimistic concurrency).
export async function putFile(path, text, { sha, message, token, branch = GITHUB_BRANCH }) {
  const data = await request(contentsPath(path), {
    method: 'PUT',
    token,
    body: {
      message,
      content: utf8ToBase64(text),
      branch,
      ...(sha ? { sha } : {}),
    },
  });
  return { sha: data.content.sha };
}

export async function deleteFile(path, sha, message, token, { branch = GITHUB_BRANCH } = {}) {
  await request(contentsPath(path), {
    method: 'DELETE',
    token,
    body: { message, sha, branch },
  });
}

// Binary upload (content already base64) through XMLHttpRequest so the caller can show real
// upload progress; fetch() has no upload progress events.
export function putBinaryFile(path, base64, { sha, message, token, branch = GITHUB_BRANCH, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_ROOT}${contentsPath(path)}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new GitHubApiError('Could not reach GitHub. Check your internet connection.', 0));
    xhr.onabort = () => reject(new GitHubApiError('Upload cancelled.', 0));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve({ sha: JSON.parse(xhr.responseText).content.sha });
        } catch {
          resolve({ sha: null });
        }
        return;
      }
      let detail = '';
      try { detail = JSON.parse(xhr.responseText).message; } catch { /* ignore */ }
      reject(friendlyError(xhr.status, detail));
    };
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(JSON.stringify({ message, content: base64, branch, ...(sha ? { sha } : {}) }));
  });
}

export async function branchExists(branch, token) {
  try {
    await request(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${branch}`, { token });
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

// Creates a branch with no parent commit (so it does not drag the app's history along),
// seeded with a single text file.
export async function createOrphanBranch(branch, seedPath, seedText, message, token) {
  const repo = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
  const blob = await request(`${repo}/git/blobs`, { method: 'POST', token, body: { content: seedText, encoding: 'utf-8' } });
  const tree = await request(`${repo}/git/trees`, {
    method: 'POST',
    token,
    body: { tree: [{ path: seedPath, mode: '100644', type: 'blob', sha: blob.sha }] },
  });
  const commit = await request(`${repo}/git/commits`, { method: 'POST', token, body: { message, tree: tree.sha, parents: [] } });
  await request(`${repo}/git/refs`, { method: 'POST', token, body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
}

// Lists entries of a directory. Returns [] if the directory does not exist.
export async function listDir(path, token, { branch = GITHUB_BRANCH } = {}) {
  try {
    const data = await request(`${contentsPath(path)}?ref=${branch}`, { token });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}
