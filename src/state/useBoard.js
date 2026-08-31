import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { boardReducer, HISTORY_ACTIONS } from './boardReducer';
import { saveBoard as syncSaveBoard, ConflictError } from '../lib/boardSync';
import { describeAction, pushActivity } from '../lib/activity';
import { getDisplayName } from '../lib/displayName';

const HISTORY_LIMIT = 60;
const AUTOSAVE_DELAY = 1200;

function reducerWithActivity(state, action) {
  if (action.type !== '__WRAPPED__') return boardReducer(state, action);
  const description = describeAction(action.inner, state);
  const next = boardReducer(state, action.inner);
  return description ? pushActivity(next, { name: action.name, ...description }) : next;
}

export function useBoard(initialBoard, initialSha) {
  const [board, rawDispatch] = useReducer(reducerWithActivity, initialBoard);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const skipHistoryRef = useRef(false);
  const shaRef = useRef(initialSha);
  const prevBoardIdRef = useRef(initialBoard.id);
  const [, forceRender] = useState(0);
  const saveTimer = useRef(null);
  const [saveState, setSaveState] = useState('saved');
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

  const performSave = useCallback(
    async (boardToSave, { force = false } = {}) => {
      setSaveState('saving');
      try {
        const { sha } = await syncSaveBoard(boardToSave.id, boardToSave, shaRef.current, { force });
        shaRef.current = sha;
        setSaveState('saved');
        setConflict(null);
      } catch (err) {
        if (err instanceof ConflictError) {
          setConflict({ remoteBoard: err.remoteBoard, remoteSha: err.remoteSha });
          setSaveState('conflict');
        } else {
          console.error('Board sync failed', err);
          setSaveState('error');
        }
      }
    },
    []
  );

  // autosave, debounced
  useEffect(() => {
    if (prevBoardIdRef.current !== board.id) {
      prevBoardIdRef.current = board.id;
      return;
    }
    if (conflict) return; // don't save over an unresolved conflict
    setSaveState('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      performSave({ ...board, updatedAt: new Date().toISOString() });
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const retrySync = useCallback(() => {
    performSave({ ...board, updatedAt: new Date().toISOString() });
  }, [board, performSave]);

  useEffect(() => {
    const onOnline = () => {
      if (saveState === 'error') retrySync();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [saveState, retrySync]);

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

  return { board, dispatch, undo, redo, canUndo, canRedo, saveState, conflict, resolveConflict, retrySync };
}
