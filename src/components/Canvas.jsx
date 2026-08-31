import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ItemRenderer from './items/ItemRenderer.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import { computeSnap, rectsIntersect } from '../utils/geometry';
import './Canvas.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

export default function Canvas({
  board,
  dispatch,
  selectedIds,
  setSelectedIds,
  viewport,
  setViewport,
  highlightedIds,
  canvasRef,
  worldRef,
}) {
  const containerRef = canvasRef;
  const dragState = useRef(null);
  const [guides, setGuides] = useState({ x: null, y: null });
  const [marquee, setMarquee] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const isPanningRef = useRef(false);
  const spaceHeldRef = useRef(false);

  const items = board.items;
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const screenToCanvas = useCallback(
    (sx, sy) => {
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (sx - rect.left - viewport.panX) / viewport.zoom,
        y: (sy - rect.top - viewport.panY) / viewport.zoom,
      };
    },
    [viewport, containerRef]
  );

  // ---- pan & zoom ----
  // Attached as a native, non-passive listener: React's onWheel prop is passive by
  // default, which silently drops preventDefault() and lets the page/trackpad zoom
  // or scroll instead of the canvas on some browsers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setViewport((v) => {
          const nextZoom = clamp(v.zoom * (1 - e.deltaY * 0.012), MIN_ZOOM, MAX_ZOOM);
          const worldX = (cursor.x - v.panX) / v.zoom;
          const worldY = (cursor.y - v.panY) / v.zoom;
          return { zoom: nextZoom, panX: cursor.x - worldX * nextZoom, panY: cursor.y - worldY * nextZoom };
        });
      } else {
        setViewport((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [containerRef, setViewport]);

  const startPan = (e) => {
    isPanningRef.current = true;
    const start = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    const onMove = (ev) => {
      setViewport((v) => ({ ...v, panX: start.panX + (ev.clientX - start.x), panY: start.panY + (ev.clientY - start.y) }));
    };
    const onUp = () => {
      isPanningRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- background click: marquee select or clear ----
  const onBackgroundMouseDown = (e) => {
    if (e.button === 1 || spaceHeldRef.current) {
      startPan(e);
      return;
    }
    if (e.target !== e.currentTarget) return;
    const start = screenToCanvas(e.clientX, e.clientY);
    let didDrag = false;
    const onMove = (ev) => {
      const current = screenToCanvas(ev.clientX, ev.clientY);
      didDrag = true;
      setMarquee({
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (didDrag) {
        const end = screenToCanvas(ev.clientX, ev.clientY);
        const rect = {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        };
        const hit = items.filter((i) => rectsIntersect(rect, i)).map((i) => i.id);
        setSelectedIds(hit);
      } else if (!e.shiftKey) {
        setSelectedIds([]);
      }
      setMarquee(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- item selection + drag ----
  const groupMembers = (id) => {
    const item = itemsById[id];
    if (!item) return [id];
    if (item.groupId) return items.filter((i) => i.groupId === item.groupId).map((i) => i.id);
    return [id];
  };

  const onItemMouseDown = (e, item) => {
    e.stopPropagation();
    if (item.locked) return;
    let nextSelected = selectedIds;
    if (e.shiftKey) {
      nextSelected = selectedSet.has(item.id)
        ? selectedIds.filter((id) => id !== item.id)
        : [...selectedIds, item.id];
    } else if (!selectedSet.has(item.id)) {
      nextSelected = groupMembers(item.id);
    }
    setSelectedIds(nextSelected);

    const draggingIds = new Set(nextSelected.flatMap((id) => idAndChildren(id, items)));
    const startPositions = {};
    items.forEach((i) => {
      if (draggingIds.has(i.id)) startPositions[i.id] = { x: i.x, y: i.y };
    });
    const start = screenToCanvas(e.clientX, e.clientY);
    dragState.current = { startX: start.x, startY: start.y, startPositions, moved: false };

    const onMove = (ev) => {
      const current = screenToCanvas(ev.clientX, ev.clientY);
      let dx = current.x - dragState.current.startX;
      let dy = current.y - dragState.current.startY;
      dragState.current.moved = true;

      if (board.settings.snapDistance > 0) {
        const primaryId = Object.keys(dragState.current.startPositions)[0];
        const primary = itemsById[primaryId];
        const movedRect = {
          x: dragState.current.startPositions[primaryId].x + dx,
          y: dragState.current.startPositions[primaryId].y + dy,
          width: primary.width,
          height: primary.height,
        };
        const others = items.filter((i) => !draggingIds.has(i.id));
        const snap = computeSnap(movedRect, others, board.settings.gridSize, board.settings.snapDistance);
        dx += snap.dx;
        dy += snap.dy;
        setGuides({ x: snap.guideX, y: snap.guideY });
      }

      const patches = {};
      Object.entries(dragState.current.startPositions).forEach(([id, pos]) => {
        patches[id] = { x: pos.x + dx, y: pos.y + dy };
      });
      dragState.current.lastPatches = patches;
      dispatch({ type: 'UPDATE_ITEMS', patches });

      // live drop-target highlight: any non-column item being dragged over a column
      const draggableId = Object.keys(patches).find((id) => itemsById[id]?.type !== 'column');
      if (draggableId) {
        const rect = { ...itemsById[draggableId], ...patches[draggableId] };
        const col = findColumnUnder(items, rect);
        setDropTargetId(col ? col.id : null);
      } else {
        setDropTargetId(null);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setGuides({ x: null, y: null });
      setDropTargetId(null);
      if (dragState.current?.moved) {
        const patches = { ...dragState.current.lastPatches };
        const draggedIdSet = new Set(Object.keys(patches));
        const touchedColumnIds = new Set();
        // drop any dragged, non-column item onto the column it's released over (or detach it)
        Object.keys(patches).forEach((draggedId) => {
          const dragged = itemsById[draggedId];
          if (!dragged || dragged.type === 'column') return;
          // its column parent is moving right along with it (whole group dragged together) —
          // keep the relationship as-is instead of re-checking against the column's stale,
          // pre-drag position
          if (dragged.parentId && draggedIdSet.has(dragged.parentId)) {
            touchedColumnIds.add(dragged.parentId);
            return;
          }
          if (dragged.parentId) touchedColumnIds.add(dragged.parentId);
          const draggedRect = { ...dragged, ...patches[draggedId] };
          const col = findColumnUnder(items, draggedRect);
          patches[draggedId] = { ...patches[draggedId], parentId: col ? col.id : null };
          if (col) touchedColumnIds.add(col.id);
        });
        // re-run layout on any column whose membership changed, using positions post-drag
        const itemsAfterDrag = items.map((i) => (patches[i.id] ? { ...i, ...patches[i.id] } : i));
        touchedColumnIds.forEach((colId) => {
          Object.assign(patches, layoutColumn(itemsAfterDrag, colId));
        });
        dispatch({ type: 'COMMIT_ITEMS', patches });
      }
      dragState.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- resize (single selection) ----
  const onResizeStart = (e, item, handle) => {
    e.stopPropagation();
    e.preventDefault();
    const start = screenToCanvas(e.clientX, e.clientY);
    const orig = { x: item.x, y: item.y, width: item.width, height: item.height };
    const aspectRatio =
      item.type === 'image' && item.naturalWidth && item.naturalHeight
        ? item.naturalWidth / item.naturalHeight
        : null;
    let lastPatch = orig;
    const onMove = (ev) => {
      const current = screenToCanvas(ev.clientX, ev.clientY);
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      lastPatch = applyResize(orig, handle, dx, dy, aspectRatio);
      dispatch({ type: 'UPDATE_ITEMS', patches: { [item.id]: lastPatch } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const patches = { [item.id]: lastPatch };
      const columnId = item.type === 'column' ? item.id : item.parentId;
      if (columnId) {
        const itemsAfterResize = items.map((i) => (patches[i.id] ? { ...i, ...patches[i.id] } : i));
        Object.assign(patches, layoutColumn(itemsAfterResize, columnId));
      }
      dispatch({ type: 'COMMIT_ITEMS', patches });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- rotate (single selection) ----
  const onRotateStart = (e, item) => {
    e.stopPropagation();
    e.preventDefault();
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    let lastRotation = item.rotation || 0;
    const onMove = (ev) => {
      const current = screenToCanvas(ev.clientX, ev.clientY);
      const angle = (Math.atan2(current.y - cy, current.x - cx) * 180) / Math.PI + 90;
      lastRotation = Math.round(angle);
      dispatch({ type: 'UPDATE_ITEMS', patches: { [item.id]: { rotation: lastRotation } } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dispatch({ type: 'COMMIT_ITEMS', patches: { [item.id]: { rotation: lastRotation } } });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const bg = board.settings.background;
  const bgStyle = backgroundStyle(bg, board.settings.gridSize, board.settings.gridColor, viewport);

  return (
    <div
      className="canvas-viewport"
      ref={containerRef}
      onMouseDown={onBackgroundMouseDown}
      style={bgStyle}
    >
      <div
        ref={worldRef}
        className="canvas-world"
        style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
      >
        {items
          .slice()
          .sort((a, b) => {
            const layerA = a.type === 'column' ? 0 : 1;
            const layerB = b.type === 'column' ? 0 : 1;
            return layerA !== layerB ? layerA - layerB : a.zIndex - b.zIndex;
          })
          .map((item) => (
            <ItemRenderer
              key={item.id}
              item={item}
              board={board}
              dispatch={dispatch}
              selected={selectedSet.has(item.id)}
              highlighted={highlightedIds?.has(item.id)}
              dropTarget={item.id === dropTargetId}
              onMouseDown={(e) => onItemMouseDown(e, item)}
              onResizeStart={onResizeStart}
              onRotateStart={onRotateStart}
            />
          ))}

        {guides.x !== null && <div className="snap-guide vertical" style={{ left: guides.x }} />}
        {guides.y !== null && <div className="snap-guide horizontal" style={{ top: guides.y }} />}

        {marquee && (
          <div
            className="marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
          />
        )}
      </div>

      {selectedIds.length > 0 && (
        <SelectionToolbar
          board={board}
          dispatch={dispatch}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      )}
    </div>
  );
}

function idAndChildren(id, items) {
  const children = items.filter((i) => i.parentId === id).map((i) => i.id);
  return [id, ...children];
}

const COLUMN_PADDING = 12;
const COLUMN_LABEL_HEIGHT = 34;
const COLUMN_GAP = 10;

// Stacks a column's children vertically inside it, fitting them to its inner width
// (preserving aspect ratio for images) and growing the column to fit their total height.
function layoutColumn(items, columnId) {
  const column = items.find((i) => i.id === columnId && i.type === 'column');
  if (!column) return {};
  const children = items.filter((i) => i.parentId === columnId);
  const patches = {};
  const innerWidth = Math.max(40, column.width - COLUMN_PADDING * 2);
  let cursorY = column.y + COLUMN_LABEL_HEIGHT;

  children.forEach((child) => {
    const width = innerWidth;
    let height;
    if (child.type === 'image' && child.naturalWidth && child.naturalHeight) {
      height = Math.round((width * child.naturalHeight) / child.naturalWidth);
    } else {
      height = Math.round((child.height / child.width) * width) || child.height;
    }
    height = Math.max(30, height);
    patches[child.id] = { x: column.x + COLUMN_PADDING, y: cursorY, width, height };
    cursorY += height + COLUMN_GAP;
  });

  const contentHeight = children.length ? cursorY - column.y - COLUMN_GAP + COLUMN_PADDING : column.height;
  patches[column.id] = { height: Math.max(160, contentHeight) };
  return patches;
}

function findColumnUnder(items, dragged) {
  const center = { x: dragged.x + dragged.width / 2, y: dragged.y + dragged.height / 2 };
  return items.find(
    (i) =>
      i.type === 'column' &&
      i.id !== dragged.id &&
      center.x >= i.x &&
      center.x <= i.x + i.width &&
      center.y >= i.y &&
      center.y <= i.y + i.height
  );
}

function applyResize(orig, handle, dx, dy, aspectRatio) {
  let { x, y, width, height } = orig;
  if (handle.includes('e')) width = Math.max(40, orig.width + dx);
  if (handle.includes('s')) height = Math.max(30, orig.height + dy);
  if (handle.includes('w')) {
    width = Math.max(40, orig.width - dx);
    x = orig.x + orig.width - width;
  }
  if (handle.includes('n')) {
    height = Math.max(30, orig.height - dy);
    y = orig.y + orig.height - height;
  }

  if (aspectRatio) {
    const isCorner = handle.length === 2;
    if (isCorner) {
      const scale = Math.abs(dx) >= Math.abs(dy) ? width / orig.width : height / orig.height;
      width = Math.max(40, orig.width * scale);
      height = Math.max(30, orig.height * scale);
    } else if (handle === 'e' || handle === 'w') {
      height = Math.max(30, width / aspectRatio);
    } else if (handle === 'n' || handle === 's') {
      width = Math.max(40, height * aspectRatio);
    }
    // re-anchor so the edge/corner opposite the dragged handle stays put
    if (handle.includes('w')) x = orig.x + orig.width - width;
    if (handle.includes('n')) y = orig.y + orig.height - height;
  }

  return { x, y, width, height };
}

function backgroundStyle(bg, gridSize, gridColor, viewport) {
  const base = { position: 'relative', overflow: 'hidden' };
  const offsetX = viewport.panX % (gridSize * viewport.zoom);
  const offsetY = viewport.panY % (gridSize * viewport.zoom);
  const size = gridSize * viewport.zoom;

  if (bg.type === 'image' && bg.imageDataUrl) {
    return { ...base, backgroundImage: `url(${bg.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (bg.type === 'color') {
    return { ...base, background: bg.color || '#ffffff' };
  }
  const dotColor = bg.type === 'dotted-black' ? '#00000022' : gridColor + '80';
  const pageColor = bg.type === 'dotted-black' ? '#111114' : 'var(--canvas-bg)';
  return {
    ...base,
    background: pageColor,
    backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${offsetX}px ${offsetY}px`,
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
