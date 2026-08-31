import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './Toolbar.jsx';
import Canvas from './Canvas.jsx';
import MiniMap from './MiniMap.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ExportDialog from './ExportDialog.jsx';
import ActivityPanel from './ActivityPanel.jsx';
import ConflictDialog from './ConflictDialog.jsx';
import { useBoard } from '../state/useBoard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { makeItem } from '../state/boardModel';
import { uid } from '../utils/id';
import {
  compressImage,
  pickClipboardImageFile,
  readClipboardSvg,
  svgMarkupToDataUrl,
  parseSvgIntrinsicSize,
} from '../utils/image';
import { normalizeHex } from '../utils/color';
import './BoardEditor.css';
import './items/items.css';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export default function BoardEditor({ board: initialBoard, sha, collaboratorName, onChangeName }) {
  const { board, dispatch, undo, redo, canUndo, canRedo, saveState, conflict, resolveConflict, saveNow } =
    useBoard(initialBoard, sha);
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const observer = new ResizeObserver(() => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomBy = useCallback(
    (factor) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setViewport((v) => {
        const nextZoom = clamp(v.zoom * factor, 0.1, 4);
        const worldX = (cx - v.panX) / v.zoom;
        const worldY = (cy - v.panY) / v.zoom;
        return { zoom: nextZoom, panX: cx - worldX * nextZoom, panY: cy - worldY * nextZoom };
      });
    },
    []
  );

  const addItem = useCallback(
    (type) => {
      const centerX = (viewportSize.width / 2 - viewport.panX) / viewport.zoom - 120;
      const centerY = (viewportSize.height / 2 - viewport.panY) / viewport.zoom - 80;
      const item = makeItem(type, { x: centerX, y: centerY });
      dispatch({ type: 'ADD_ITEM', item });
      setSelectedIds([item.id]);
    },
    [dispatch, viewport, viewportSize]
  );

  // Paste an image from the clipboard anywhere on the board (not just inside an empty image
  // placeholder) as a new image item, sized to fit while keeping its natural aspect ratio.
  useEffect(() => {
    const onPaste = (e) => {
      const active = document.activeElement;
      const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (isEditable) return;
      // checked before any file: design tools put SVG markup on the clipboard *alongside* a
      // rasterized PNG fallback, and taking the PNG is what used to flatten pasted vectors
      const clipboardSvg = readClipboardSvg(e.clipboardData);
      if (clipboardSvg) {
        e.preventDefault();
        addSvgItem(clipboardSvg);
        return;
      }
      const file = pickClipboardImageFile(e.clipboardData?.items);
      if (!file) {
        const text = e.clipboardData?.getData('text/plain')?.trim();
        const hex = text ? normalizeHex(text) : null;
        if (hex) {
          e.preventDefault();
          const width = 200;
          const height = 200;
          const x = (viewportSize.width / 2 - viewport.panX) / viewport.zoom - width / 2;
          const y = (viewportSize.height / 2 - viewport.panY) / viewport.zoom - height / 2;
          const item = makeItem('color', { x, y, width, height, hex });
          dispatch({ type: 'ADD_ITEM', item });
          setSelectedIds([item.id]);
        } else if (text && /^(https?:\/\/|www\.)\S+$/i.test(text)) {
          e.preventDefault();
          const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
          const width = 240;
          const height = 160;
          const x = (viewportSize.width / 2 - viewport.panX) / viewport.zoom - width / 2;
          const y = (viewportSize.height / 2 - viewport.panY) / viewport.zoom - height / 2;
          const item = makeItem('url', { x, y, width, height, url });
          dispatch({ type: 'ADD_ITEM', item });
          setSelectedIds([item.id]);
        }
        return;
      }
      e.preventDefault();
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => addSvgItem(reader.result);
        reader.readAsText(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        compressImage(reader.result, file.type).then((compressed) => {
          const src = compressed ? compressed.dataUrl : reader.result;
          const naturalWidth = compressed ? compressed.width : 0;
          const naturalHeight = compressed ? compressed.height : 0;
          const maxDim = 360;
          const scale = naturalWidth ? Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight)) : 1;
          const width = Math.round((naturalWidth || 240) * scale) || 240;
          const height = Math.round((naturalHeight || 160) * scale) || 160;
          const x = (viewportSize.width / 2 - viewport.panX) / viewport.zoom - width / 2;
          const y = (viewportSize.height / 2 - viewport.panY) / viewport.zoom - height / 2;
          const item = makeItem('image', { x, y, width, height, src, naturalWidth, naturalHeight });
          dispatch({ type: 'ADD_ITEM', item });
          setSelectedIds([item.id]);
        });
      };
      reader.readAsDataURL(file);
    };

    // Kept as raw SVG markup (not rasterized) so pasted vectors stay crisp at any zoom
    // and keep their native transparency instead of a canvas-flattened black background.
    const addSvgItem = (svgText) => {
      const intrinsic = parseSvgIntrinsicSize(svgText);
      const maxDim = 360;
      const ratio = intrinsic ? intrinsic.width / intrinsic.height : 1.5;
      const width = intrinsic ? Math.min(maxDim, intrinsic.width) : 240;
      const height = Math.round(width / ratio) || 160;
      const x = (viewportSize.width / 2 - viewport.panX) / viewport.zoom - width / 2;
      const y = (viewportSize.height / 2 - viewport.panY) / viewport.zoom - height / 2;
      const item = makeItem('image', {
        x,
        y,
        width,
        height,
        src: svgMarkupToDataUrl(svgText),
        naturalWidth: intrinsic?.width || 0,
        naturalHeight: intrinsic?.height || 0,
      });
      dispatch({ type: 'ADD_ITEM', item });
      setSelectedIds([item.id]);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [dispatch, viewport, viewportSize]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    dispatch({ type: 'DELETE_ITEMS', ids: selectedIds });
    setSelectedIds([]);
  }, [dispatch, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (!selectedIds.length) return;
    const selectedItems = board.items.filter((i) => selectedIds.includes(i.id));
    const idMap = {};
    const clones = selectedItems.map((i) => {
      const newId = uid('item');
      idMap[i.id] = newId;
      return { ...i, id: newId, x: i.x + 24, y: i.y + 24 };
    });
    clones.forEach((c) => {
      if (c.parentId && idMap[c.parentId]) c.parentId = idMap[c.parentId];
    });
    dispatch({ type: 'DUPLICATE_ITEMS', items: clones });
    setSelectedIds(clones.map((c) => c.id));
  }, [board.items, dispatch, selectedIds]);

  const nudgeSelected = useCallback(
    (key, amount) => {
      if (!selectedIds.length) return;
      const delta = {
        ArrowUp: { x: 0, y: -amount },
        ArrowDown: { x: 0, y: amount },
        ArrowLeft: { x: -amount, y: 0 },
        ArrowRight: { x: amount, y: 0 },
      }[key];
      const patches = {};
      board.items.forEach((i) => {
        if (selectedIds.includes(i.id)) patches[i.id] = { x: i.x + delta.x, y: i.y + delta.y };
      });
      dispatch({ type: 'COMMIT_ITEMS', patches });
    },
    [board.items, dispatch, selectedIds]
  );

  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: deleteSelected,
    onDuplicate: duplicateSelected,
    onSelectAll: () => setSelectedIds(board.items.map((i) => i.id)),
    onNudge: nudgeSelected,
    onEscape: () => setSelectedIds([]),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onZoomIn: () => zoomBy(1.15),
    onZoomOut: () => zoomBy(1 / 1.15),
    onZoomReset: () => setViewport((v) => ({ ...v, zoom: 1 })),
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
        zoom={viewport.zoom}
        onZoomIn={() => zoomBy(1.15)}
        onZoomOut={() => zoomBy(1 / 1.15)}
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
          viewport={viewport}
          setViewport={setViewport}
          highlightedIds={highlightedIds}
          canvasRef={canvasRef}
          worldRef={worldRef}
        />
        <MiniMap board={board} viewport={viewport} setViewport={setViewport} viewportSize={viewportSize} />
      </div>

      {settingsOpen && (
        <SettingsPanel board={board} dispatch={dispatch} onClose={() => setSettingsOpen(false)} />
      )}
      {exportOpen && (
        <ExportDialog board={board} canvasRef={canvasRef} worldRef={worldRef} onClose={() => setExportOpen(false)} />
      )}
      {activityOpen && <ActivityPanel activity={board.activity || []} onClose={() => setActivityOpen(false)} />}
      {conflict && <ConflictDialog onReload={() => resolveConflict('reload')} onOverwrite={() => resolveConflict('overwrite')} />}
    </div>
  );
}
