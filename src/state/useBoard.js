import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { boardReducer, HISTORY_ACTIONS } from './boardReducer';
import { saveBoard as syncSaveBoard, cacheBoardLocally, ConflictError } from '../lib/boardSync';
import { describeAction, pushActivity } from '../lib/activity';
import { getDisplayName } from '../lib/displayName';

const HISTORY_LIMIT = 60;
const LOCAL_CACHE_DELAY = 500;
const AUTOSAVE_DELAY = 4000;

function reducerWithActivity(state, action) {
  if (action.type !== '__WRAPPED__') return boardReducer(state, action);
  const description = describeAction(action.inner, state);
  const next = boardReducer(state, action.inner);
  return description ? pushActivity(next, { name: action.name, ...description }) : next;
}

// Edits are cached to IndexedDB immediately (no network) and pushed to GitHub a few seconds
// after the last change, so a shared board is never stale because nobody pressed Save. The
// Save button and Ctrl+S still force an immediate push.
export function useBoard(initialBoard, initialSha) {
  const [board, rawDispatch] = useReducer(reducerWithActivity, initialBoard);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const skipHistoryRef = useRef(false);
  const shaRef = useRef(initialSha);
  const prevBoardIdRef = useRef(initialBoard.id);
  const [, forceRender] = useState(0);
  const cacheTimer = useRef(null);
  const autosaveTimer = useRef(null);
  const [saveState, setSaveState] = useState('saved'); // saved | unsaved | saving | error | conflict
  const [conflict, setConflict] = useState(null); // { remoteBoard, remoteSha }

  useEffect(() => {
    rawDispatch({ type: 'SET_BOARD', board: initialBoard });
    shaRef.current = initialSha;
    prevBoardIdRef.current = initialBoard.id;
    pastRef.current = [];
    futureRef.current = [];
    setConflict(null);
    setSaveState('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBoard.id]);

  const dispatch = useCallback(
    (action) => {
      if (HISTORY_ACTIONS.has(action.type) && !skipHistoryRef.current) {
        pastRef.current.push(board);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
        futureRef.current = [];
      }
      rawDispatch({ type: '__WRAPPED__', inner: action, name: getDisplayName() });
    },
    [board]
  );

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const previous = pastRef.current.pop();
    futureRef.current.push(board);
    skipHistoryRef.current = true;
    rawDispatch({ type: 'SET_BOARD', board: pushActivity(previous, { name: getDisplayName(), verb: 'restored a previous version of', itemType: 'the board', itemTitle: '' }) });
    skipHistoryRef.current = false;
    forceRender((n) => n + 1);
  }, [board]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current.pop();
    pastRef.current.push(board);
    skipHistoryRef.current = true;
    rawDispatch({ type: 'SET_BOARD', board: next });
    skipHistoryRef.current = false;
    forceRender((n) => n + 1);
  }, [board]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const savingRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const [saveError, setSaveError] = useState(null);

  const performSave = useCallback(
    async (boardToSave, { force = false } = {}) => {
      // A save already in flight used to make the new request vanish, so a click during a
      // slow save looked like "saving doesn't work". The newest board is queued instead.
      if (savingRef.current) {
        pendingSaveRef.current = { boardToSave, force };
        return;
      }
      savingRef.current = true;
      setSaveState('saving');
      try {
        const { sha } = await syncSaveBoard(boardToSave.id, boardToSave, shaRef.current, { force });
        shaRef.current = sha;
        setSaveState('saved');
        setSaveError(null);
        setConflict(null);
      } catch (err) {
        if (err instanceof ConflictError) {
          setConflict({ remoteBoard: err.remoteBoard, remoteSha: err.remoteSha });
          setSaveState('conflict');
        } else {
          console.error('Board sync failed', err);
          setSaveError(err.message || 'Sync failed.');
          setSaveState('error');
        }
      } finally {
        savingRef.current = false;
        const queued = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (queued) performSaveRef.current(queued.boardToSave, { force: queued.force });
      }
    },
    []
  );

  // performSave re-enters itself for a queued save; a ref keeps that from needing a
  // self-referencing dependency.
  const performSaveRef = useRef(performSave);
  performSaveRef.current = performSave;

  // Marks unsaved and mirrors to the local offline cache (no network) whenever the board changes.
  useEffect(() => {
    if (prevBoardIdRef.current !== board.id) {
      prevBoardIdRef.current = board.id;
      return;
    }
    if (conflict) return; // don't touch anything while a conflict is unresolved
    setSaveState((s) => (s === 'saving' ? s : 'unsaved'));
    clearTimeout(cacheTimer.current);
    cacheTimer.current = setTimeout(() => {
      cacheBoardLocally(board.id, board, shaRef.current).catch(() => {});
    }, LOCAL_CACHE_DELAY);
    // Edits are also pushed to GitHub on their own once typing/dragging stops, so a shared
    // link never shows a stale board just because nobody pressed Save.
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      performSaveRef.current({ ...board, updatedAt: new Date().toISOString() });
    }, AUTOSAVE_DELAY);
    return () => {
      clearTimeout(cacheTimer.current);
      clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const saveNow = useCallback(() => {
    performSave({ ...board, updatedAt: new Date().toISOString() });
  }, [board, performSave]);

  useEffect(() => {
    const onOnline = () => {
      if (saveState === 'error') saveNow();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [saveState, saveNow]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (saveState === 'unsaved' || saveState === 'error') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const resolveConflict = useCallback(
    (mode) => {
      if (!conflict) return;
      if (mode === 'reload') {
        shaRef.current = conflict.remoteSha;
        skipHistoryRef.current = true;
        rawDispatch({ type: 'SET_BOARD', board: conflict.remoteBoard });
        skipHistoryRef.current = false;
        setConflict(null);
        setSaveState('saved');
      } else if (mode === 'overwrite') {
        performSave({ ...board, updatedAt: new Date().toISOString() }, { force: true });
      }
    },
    [conflict, board, performSave]
  );

  return { board, dispatch, undo, redo, canUndo, canRedo, saveState, saveError, conflict, resolveConflict, saveNow };
}
