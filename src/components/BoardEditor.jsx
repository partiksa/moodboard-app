import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './Toolbar.jsx';
import Canvas from './Canvas.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ExportDialog from './ExportDialog.jsx';
import ActivityPanel from './ActivityPanel.jsx';
import ConflictDialog from './ConflictDialog.jsx';
import { useBoard } from '../state/useBoard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { makeItem } from '../state/boardModel';
import { uid } from '../utils/id';
import { compressImage } from '../utils/image';
import './BoardEditor.css';
import './items/items.css';

export default function BoardEditor({ board: initialBoard, sha, collaboratorName, onChangeName }) {
  const { board, dispatch, undo, redo, canUndo, canRedo, saveState, conflict, resolveConflict, saveNow } =
    useBoard(initialBoard, sha);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const gridRef = useRef(null);
  const searchInputRef = useRef(null);

  const addItem = useCallback(
    (type) => {
      const item = makeItem(type);
      dispatch({ type: 'ADD_ITEM', item });
      setSelectedIds([item.id]);
    },
    [dispatch]
  );

  // Paste an image from the clipboard anywhere on the board (not just inside an empty image
  // placeholder) as a new grid item; it fills its cell (scale-to-fit) regardless of its ratio.
  useEffect(() => {
    const onPaste = (e) => {
      const active = document.activeElement;
      const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (isEditable) return;
      const file = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        compressImage(reader.result, file.type).then((compressed) => {
          const src = compressed ? compressed.dataUrl : reader.result;
          const naturalWidth = compressed ? compressed.width : 0;
          const naturalHeight = compressed ? compressed.height : 0;
          const item = makeItem('image', { src, naturalWidth, naturalHeight });
          dispatch({ type: 'ADD_ITEM', item });
          setSelectedIds([item.id]);
        });
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [dispatch]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    dispatch({ type: 'DELETE_ITEMS', ids: selectedIds });
    setSelectedIds([]);
  }, [dispatch, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (!selectedIds.length) return;
    const selectedItems = board.items.filter((i) => selectedIds.includes(i.id));
    const clones = selectedItems.map((i) => ({ ...i, id: uid('item') }));
    const lastIndex = Math.max(...selectedItems.map((i) => board.items.indexOf(i)));
    const afterId = board.items[lastIndex]?.id;
    dispatch({ type: 'DUPLICATE_ITEMS', items: clones, afterId });
    setSelectedIds(clones.map((c) => c.id));
  }, [board.items, dispatch, selectedIds]);

  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: deleteSelected,
    onDuplicate: duplicateSelected,
    onSelectAll: () => setSelectedIds(board.items.map((i) => i.id)),
    onEscape: () => setSelectedIds([]),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onSave: saveNow,
  });

  const highlightedIds = useMemo(() => {
    if (!search.trim()) return new Set();
    const q = search.toLowerCase();
    return new Set(
      board.items
        .filter((i) => JSON.stringify(i).toLowerCase().includes(q))
        .map((i) => i.id)
    );
  }, [search, board.items]);

  return (
    <div className="board-editor">
      <Toolbar
        boardName={board.name}
        onAddItem={addItem}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        search={search}
        onSearchChange={setSearch}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        saveState={saveState}
        onSave={saveNow}
        collaboratorName={collaboratorName}
        onChangeName={onChangeName}
        onToggleActivity={() => setActivityOpen((v) => !v)}
      />
      <div className="board-canvas-area">
        <Canvas
          board={board}
          dispatch={dispatch}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          highlightedIds={highlightedIds}
          gridRef={gridRef}
        />
      </div>

      {settingsOpen && (
        <SettingsPanel board={board} dispatch={dispatch} onClose={() => setSettingsOpen(false)} />
      )}
      {exportOpen && (
        <ExportDialog board={board} gridRef={gridRef} onClose={() => setExportOpen(false)} />
      )}
      {activityOpen && <ActivityPanel activity={board.activity || []} onClose={() => setActivityOpen(false)} />}
      {conflict && <ConflictDialog onReload={() => resolveConflict('reload')} onOverwrite={() => resolveConflict('overwrite')} />}
    </div>
  );
}
