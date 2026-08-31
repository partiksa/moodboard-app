import { useCallback, useMemo, useRef, useState } from 'react';
import ItemRenderer from './items/ItemRenderer.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import { DEFAULT_GRID } from '../state/boardModel';
import './Canvas.css';

const DRAG_THRESHOLD = 5;

// Note: deliberately excludes <a> — UrlCard's whole populated card is an anchor, and
// treating it as "interactive" would make it permanently impossible to select or drag.
// A plain click still opens the link fine even with our own mousedown listener attached.
function isInteractiveTarget(target) {
  return !!target.closest('input, textarea, [contenteditable="true"], button, select');
}

// Finds the index (into the pre-drag items array) that the pointer is currently "before",
// scanning in board order and comparing the pointer against each rendered cell's rect.
function computeDropIndex(items, rects, excludeId, pointerX, pointerY) {
  for (let i = 0; i < items.length; i++) {
    const id = items[i].id;
    if (id === excludeId) continue;
    const rect = rects[id];
    if (!rect) continue;
    const withinRow = pointerY >= rect.top && pointerY <= rect.bottom;
    const before = pointerY < rect.top || (withinRow && pointerX < rect.left + rect.width / 2);
    if (before) return { index: i, side: withinRow ? 'left' : 'top' };
  }
  return { index: items.length, side: null };
}

export default function Canvas({ board, dispatch, selectedIds, setSelectedIds, highlightedIds, gridRef }) {
  const items = board.items;
  const grid = board.settings.grid || DEFAULT_GRID;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const nodeRefs = useRef({});
  const dragState = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { id, side } | null

  const setNodeRef = useCallback((id) => (el) => {
    if (el) nodeRefs.current[id] = el;
    else delete nodeRefs.current[id];
  }, []);

  const onItemMouseDown = (e, item) => {
    if (isInteractiveTarget(e.target)) return;
    if (item.locked) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        moved = true;
        setDraggingId(item.id);
      }
      if (!moved) return;

      const rects = {};
      items.forEach((i) => {
        const node = nodeRefs.current[i.id];
        if (node) rects[i.id] = node.getBoundingClientRect();
      });
      const { index, side } = computeDropIndex(items, rects, item.id, ev.clientX, ev.clientY);
      const beforeItem = items[index];
      dragState.current = { toIndex: index };
      setDropIndicator(beforeItem && beforeItem.id !== item.id ? { id: beforeItem.id, side } : null);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved && dragState.current) {
        const fromIndex = items.findIndex((i) => i.id === item.id);
        let toIndex = dragState.current.toIndex;
        if (toIndex > fromIndex) toIndex -= 1;
        if (toIndex !== fromIndex) dispatch({ type: 'REORDER_ITEM', id: item.id, toIndex });
      } else if (!moved) {
        if (e.shiftKey) {
          setSelectedIds(selectedSet.has(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id]);
        } else {
          setSelectedIds([item.id]);
        }
      }
      setDraggingId(null);
      setDropIndicator(null);
      dragState.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onBackgroundMouseDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (!e.shiftKey) setSelectedIds([]);
  };

  const changeSpan = (id, patch) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const colSpan =
      patch.colSpan !== undefined ? Math.max(1, Math.min(grid.columns, patch.colSpan)) : item.colSpan || 1;
    const rowSpan = patch.rowSpan !== undefined ? Math.max(1, Math.min(4, patch.rowSpan)) : item.rowSpan || 1;
    dispatch({ type: 'COMMIT_ITEMS', patches: { [id]: { colSpan, rowSpan } } });
  };

  const bgStyle = backgroundStyle(board.settings.background, board.settings.gridSize, board.settings.gridColor);

  return (
    <div className="canvas-viewport" onMouseDown={onBackgroundMouseDown}>
      <div
        ref={gridRef}
        className="bento-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
          gridAutoRows: `${grid.rowHeight}px`,
          gap: `${grid.gutter}px`,
          ...bgStyle,
        }}
      >
        {items.map((item) => {
          const indicator = dropIndicator?.id === item.id ? dropIndicator.side : null;
          const classes = ['bento-cell'];
          if (item.id === draggingId) classes.push('dragging');
          if (indicator === 'left') classes.push('drop-before-left');
          if (indicator === 'top') classes.push('drop-before-top');
          if (highlightedIds?.has(item.id)) classes.push('highlighted');
          return (
            <div
              key={item.id}
              ref={setNodeRef(item.id)}
              className={classes.join(' ')}
              style={{
                gridColumn: `span ${item.colSpan || 1}`,
                gridRow: `span ${item.rowSpan || 1}`,
              }}
              onMouseDown={(e) => onItemMouseDown(e, item)}
              data-item-id={item.id}
            >
              <ItemRenderer
                item={item}
                board={board}
                dispatch={dispatch}
                selected={selectedSet.has(item.id)}
              />
            </div>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <SelectionToolbar
          board={board}
          dispatch={dispatch}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          grid={grid}
          changeSpan={changeSpan}
        />
      )}
    </div>
  );
}

function backgroundStyle(bg, gridSize, gridColor) {
  const base = { position: 'relative' };
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
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}
