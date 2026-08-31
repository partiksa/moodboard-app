const DB_NAME = 'moodboard-db';
const DB_VERSION = 1;
const STORE_BOARDS = 'boards';
const STORE_META = 'meta';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOARDS)) {
        db.createObjectStore(STORE_BOARDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function idbGetAllBoards() {
  const store = await tx(STORE_BOARDS, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutBoard(board) {
  const store = await tx(STORE_BOARDS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(board);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetBoard(id) {
  const store = await tx(STORE_BOARDS, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteBoard(id) {
  const store = await tx(STORE_BOARDS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetMeta(key, value) {
  const store = await tx(STORE_META, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetMeta(key) {
  const store = await tx(STORE_META, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbEstimateUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }
  return null;
}
