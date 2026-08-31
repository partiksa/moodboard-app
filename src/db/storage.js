// Portable backup export/import for a single board (download/upload a .moodboard.json file).
// Shared board persistence itself lives in src/lib/boardSync.js (GitHub) with an IndexedDB
// offline cache in src/db/indexedDb.js.

export function exportBoardToFile(board, { includePrivateNotes = false } = {}) {
  const clone = JSON.parse(JSON.stringify(board));
  if (!includePrivateNotes) {
    for (const item of clone.items) {
      if (item.privateNote) delete item.privateNote;
    }
  }
  const payload = { formatVersion: 1, exportedAt: new Date().toISOString(), board: clone };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(board.name)}.moodboard.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function sanitizeFileName(name) {
  return (name || 'board').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
}

export async function importBoardFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file could not be read: not a valid backup JSON.');
  }
  const board = parsed.board || parsed;
  if (!board || !Array.isArray(board.items)) {
    throw new Error('This file is not in the expected moodboard format.');
  }
  return board;
}
