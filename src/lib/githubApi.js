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
export async function getFile(path, token) {
  try {
    const data = await request(`${contentsPath(path)}?ref=${GITHUB_BRANCH}`, { token });
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
export async function putFile(path, text, { sha, message, token }) {
  const data = await request(contentsPath(path), {
    method: 'PUT',
    token,
    body: {
      message,
      content: utf8ToBase64(text),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    },
  });
  return { sha: data.content.sha };
}

export async function deleteFile(path, sha, message, token) {
  await request(contentsPath(path), {
    method: 'DELETE',
    token,
    body: { message, sha, branch: GITHUB_BRANCH },
  });
}

// Lists entries of a directory. Returns [] if the directory does not exist.
export async function listDir(path, token) {
  try {
    const data = await request(`${contentsPath(path)}?ref=${GITHUB_BRANCH}`, { token });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}
