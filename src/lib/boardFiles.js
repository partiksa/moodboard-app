// Per-board file library ("originals"): the bytes live on a dedicated orphan branch of the
// same repository, one folder per board, next to a small index.json that carries the
// categories the admin set up and the metadata of every file.
//
//   files/<boardId>/index.json
//   files/<boardId>/blobs/<fileId>__<name>
//
// Anyone with the board link reads the index and downloads through raw.githubusercontent.com
// (public repo, CORS enabled, so a ZIP can be assembled in the browser). Only the admin
// token can write.
import { zip } from 'fflate';
import { getFile, putFile, putBinaryFile, deleteFile, branchExists, createOrphanBranch, GitHubApiError } from './githubApi';
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } from '../config';
import { uid } from '../utils/id';

export const FILES_BRANCH = 'files';
// The Contents API takes the whole file as base64 JSON in one request; 100 MB is GitHub's
// hard ceiling for a single blob.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function emptyIndex() {
  return { version: 1, categories: [], files: [] };
}

function indexPath(boardId) {
  return `files/${boardId}/index.json`;
}

function safeName(name) {
  return name.replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
}

export function fileDownloadUrl(path) {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${FILES_BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// raw.githubusercontent.com serves SVG as text/plain with nosniff, which <img> refuses to
// render; jsDelivr mirrors the same branch with proper content types (files up to 20 MB).
export function filePreviewUrl(path) {
  if (fileExtension(path) !== 'svg') return fileDownloadUrl(path);
  return `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${FILES_BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function fileExtension(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

const KIND_BY_EXT = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', heic: 'image', tif: 'image', tiff: 'image', bmp: 'image',
  svg: 'vector', ai: 'vector', eps: 'vector', pdf: 'pdf',
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video', avi: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio', aac: 'audio', flac: 'audio', ogg: 'audio', m4a: 'audio',
  obj: 'model', fbx: 'model', glb: 'model', gltf: 'model', stl: 'model', blend: 'model', usdz: 'model', c4d: 'model', '3ds': 'model', dae: 'model',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  psd: 'design', fig: 'design', sketch: 'design', xd: 'design', indd: 'design', afdesign: 'design', afphoto: 'design',
  txt: 'text', md: 'text', json: 'text', csv: 'text', doc: 'text', docx: 'text',
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
};

export function fileKind(name) {
  return KIND_BY_EXT[fileExtension(name)] || 'other';
}

// Images and SVGs can be previewed straight from the raw URL; everything else gets an icon.
export function isPreviewable(name) {
  const ext = fileExtension(name);
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext);
}

export async function loadFileIndex(boardId, token = GITHUB_TOKEN) {
  const file = await getFile(indexPath(boardId), token, { branch: FILES_BRANCH });
  if (!file) return { index: emptyIndex(), sha: null };
  try {
    const parsed = JSON.parse(file.text);
    return { index: { ...emptyIndex(), ...parsed }, sha: file.sha };
  } catch {
    throw new Error('The file index for this board is corrupted.');
  }
}

async function ensureBranch(token) {
  if (await branchExists(FILES_BRANCH, token)) return;
  try {
    await createOrphanBranch(FILES_BRANCH, 'README.md', '# Board files\n\nOriginal files attached to moodboards. Managed by the app; do not edit by hand.\n', 'Create files branch', token);
  } catch (err) {
    // two admins racing to create it: the second one just finds it there
    if (!(err instanceof GitHubApiError && err.status === 422)) throw err;
  }
}

// Read-modify-write of index.json with one retry on a stale sha, so two quick actions in a
// row (or two admin tabs) do not clobber each other.
async function updateIndex(boardId, token, mutate, message) {
  await ensureBranch(token);
  let attempt = 0;
  for (;;) {
    const { index, sha } = await loadFileIndex(boardId, token);
    const next = mutate(structuredClone(index));
    if (!next) return index;
    next.updatedAt = new Date().toISOString();
    try {
      await putFile(indexPath(boardId), JSON.stringify(next, null, 2), { sha, message, token, branch: FILES_BRANCH });
      return next;
    } catch (err) {
      const stale = err instanceof GitHubApiError && (err.status === 409 || err.status === 422);
      if (!stale || attempt++ > 1) throw err;
    }
  }
}

export function addCategory(boardId, name, token) {
  return updateIndex(boardId, token, (index) => {
    index.categories.push({ id: uid('c'), name: name.trim(), createdAt: new Date().toISOString() });
    return index;
  }, `Add file category "${name.trim()}"`);
}

export function renameCategory(boardId, categoryId, name, token) {
  return updateIndex(boardId, token, (index) => {
    const cat = index.categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    cat.name = name.trim();
    return index;
  }, `Rename file category to "${name.trim()}"`);
}

export function moveCategory(boardId, categoryId, direction, token) {
  return updateIndex(boardId, token, (index) => {
    const i = index.categories.findIndex((c) => c.id === categoryId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= index.categories.length) return null;
    [index.categories[i], index.categories[j]] = [index.categories[j], index.categories[i]];
    return index;
  }, 'Reorder file categories');
}

// Files in a deleted category stay in the library, just without a category.
export function deleteCategory(boardId, categoryId, token) {
  return updateIndex(boardId, token, (index) => {
    index.categories = index.categories.filter((c) => c.id !== categoryId);
    index.files.forEach((f) => { if (f.categoryId === categoryId) f.categoryId = null; });
    return index;
  }, 'Delete file category');
}

export function moveFile(boardId, fileId, categoryId, token) {
  return updateIndex(boardId, token, (index) => {
    const f = index.files.find((x) => x.id === fileId);
    if (!f) return null;
    f.categoryId = categoryId || null;
    return index;
  }, 'Move file to another category');
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

export async function uploadBoardFile(boardId, file, categoryId, { token, uploadedBy, onProgress, signal } = {}) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_FILE_BYTES)} per file.`);
  }
  await ensureBranch(token);
  const id = uid('f');
  const name = safeName(file.name);
  const path = `files/${boardId}/blobs/${id}__${name}`;
  const base64 = await readAsBase64(file);
  await putBinaryFile(path, base64, {
    message: `Upload ${name}`,
    token,
    branch: FILES_BRANCH,
    onProgress,
    signal,
  });
  const entry = {
    id,
    name: file.name,
    path,
    size: file.size,
    type: file.type || '',
    categoryId: categoryId || null,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || 'Admin',
  };
  const index = await updateIndex(boardId, token, (idx) => {
    idx.files.push(entry);
    return idx;
  }, `Index ${name}`);
  return { entry, index };
}

export async function deleteBoardFile(boardId, fileEntry, token) {
  const remote = await getFile(fileEntry.path, token, { branch: FILES_BRANCH }).catch((err) => {
    // a 100 MB+ blob cannot be inlined but still has a sha; anything else is a real error
    if (err instanceof GitHubApiError && err.status === 0) return null;
    throw err;
  });
  if (remote?.sha) {
    await deleteFile(fileEntry.path, remote.sha, `Delete ${safeName(fileEntry.name)}`, token, { branch: FILES_BRANCH });
  }
  return updateIndex(boardId, token, (index) => {
    index.files = index.files.filter((f) => f.id !== fileEntry.id);
    return index;
  }, `Unindex ${safeName(fileEntry.name)}`);
}

export async function fetchFileBlob(fileEntry, { signal } = {}) {
  const res = await fetch(fileDownloadUrl(fileEntry.path), { signal });
  if (!res.ok) throw new Error(`Could not download "${fileEntry.name}" (status ${res.status}).`);
  return res.blob();
}

export function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadFile(fileEntry) {
  const blob = await fetchFileBlob(fileEntry);
  triggerDownload(blob, fileEntry.name);
}

function uniqueZipPath(used, folder, name) {
  let candidate = folder ? `${folder}/${name}` : name;
  let n = 2;
  while (used.has(candidate)) {
    const ext = fileExtension(name);
    const stem = ext ? name.slice(0, -(ext.length + 1)) : name;
    const numbered = ext ? `${stem} (${n}).${ext}` : `${stem} (${n})`;
    candidate = folder ? `${folder}/${numbered}` : numbered;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

// Builds "<board>.zip" in the browser: one folder per category, uncategorised files at the root.
// Files are already compressed formats most of the time, so they are stored, not deflated.
export async function downloadAllAsZip(index, files, zipName, { onProgress, signal } = {}) {
  const byCategory = new Map(index.categories.map((c) => [c.id, safeName(c.name)]));
  const used = new Set();
  const entries = {};
  let done = 0;
  for (const f of files) {
    const blob = await fetchFileBlob(f, { signal });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const folder = f.categoryId ? byCategory.get(f.categoryId) || '' : '';
    entries[uniqueZipPath(used, folder, safeName(f.name))] = [bytes, { level: 0 }];
    done += 1;
    onProgress?.(done / files.length);
  }
  const data = await new Promise((resolve, reject) => {
    zip(entries, (err, out) => (err ? reject(err) : resolve(out)));
  });
  triggerDownload(new Blob([data], { type: 'application/zip' }), `${safeName(zipName) || 'files'}.zip`);
}
