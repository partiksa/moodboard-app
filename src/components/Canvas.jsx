import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ItemRenderer from './items/ItemRenderer.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import { computeSmartGuides, guidesForRect, snapResizeRect, rectsIntersect } from '../utils/geometry';
import { layoutColumn } from '../utils/columnLayout';
import { makeItem } from '../state/boardModel';
import { strokePath, drawingFromWorldStrokes, appendWorldStroke, removeStrokes, strokesNear } from '../utils/drawing';
import './Canvas.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

export default function Canvas({
  viewportSize,
  onColorCheck,
  draw,
  onDrawPenSeen,
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
  const [guides, setGuides] = useState([]);
  const [sizeBadge, setSizeBadge] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const isPanningRef = useRef(false);
  const spaceHeldRef = useRef(false);
  // touch: every finger currently down, so a second one turns any gesture into a pinch
  const touchesRef = useRef(new Map());
  const pinchRef = useRef(null);
  // drawing: the stroke being drawn and the item this drawing session appends to
  const [liveStroke, setLiveStroke] = useState(null);
  const liveStrokeRef = useRef(null);
  const sessionItemRef = useRef(null);
  const drawActive = Boolean(draw?.active);

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
    let dead = false;
    const onMove = (ev) => {
      // once a second finger lands the pinch owns the viewport for the rest of this gesture
      if (pinchRef.current) dead = true;
      if (dead || ev.pointerId !== e.pointerId) return;
      setViewport((v) => ({ ...v, panX: start.panX + (ev.clientX - start.x), panY: start.panY + (ev.clientY - start.y) }));
    };
    const onUp = () => {
      isPanningRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ---- background click: marquee select or clear ----
  const onBackgroundPointerDown = (e) => {
    if (e.pointerType === 'touch') {
      trackTouch(e);
      if (touchesRef.current.size > 1) return;
    }
    // drawing mode: pen and mouse draw; a finger draws too until an Apple Pencil has been
    // seen, after that fingers only pan so a resting palm cannot scribble
    if (drawActive && !e.target.closest('.selection-toolbar, .canvas-empty') && drawPointerAllowed(e)) {
      if (draw.tool === 'eraser') startErase(e);
      else startStroke(e);
      return;
    }
    if (e.button === 1 || spaceHeldRef.current || e.pointerType === 'touch') {
      startPan(e);
      return;
    }
    if (e.target !== e.currentTarget) return;
    const start = screenToCanvas(e.clientX, e.clientY);
    let didDrag = false;
    let dead = false;
    const onMove = (ev) => {
      if (pinchRef.current) dead = true;
      if (dead) return;
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (dead) {
        setMarquee(null);
        return;
      }
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
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ---- item selection + drag ----
  const groupMembers = (id) => {
    const item = itemsById[id];
    if (!item) return [id];
    if (item.groupId) return items.filter((i) => i.groupId === item.groupId).map((i) => i.id);
    return [id];
  };

  const onItemPointerDown = (e, item) => {
    e.stopPropagation();
    if (e.pointerType === 'touch') {
      trackTouch(e);
      if (touchesRef.current.size > 1) return;
    }
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
      if (pinchRef.current || !dragState.current) return;
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
        const snap = computeSmartGuides(movedRect, others, board.settings.gridSize, board.settings.snapDistance);
        dx += snap.dx;
        dy += snap.dy;
        setGuides(snap.guides);
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGuides([]);
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

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
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
    const others = items.filter((i) => i.id !== item.id && i.parentId !== item.id);
    const onMove = (ev) => {
      const current = screenToCanvas(ev.clientX, ev.clientY);
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      let rect = applyResize(orig, handle, dx, dy, aspectRatio);
      // free-ratio items snap their dragged edges to neighbours; ratio-locked images would
      // fight the snap (it would break the aspect), so they are left alone
      if (!aspectRatio) rect = snapResizeRect(rect, handle, others, board.settings.snapDistance);
      lastPatch = rect;
      setGuides(guidesForRect(rect, others));
      setSizeBadge(rect);
      dispatch({ type: 'UPDATE_ITEMS', patches: { [item.id]: rect } });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGuides([]);
      setSizeBadge(null);
      const patches = { [item.id]: lastPatch };
      const columnId = item.type === 'column' ? item.id : item.parentId;
      if (columnId) {
        const itemsAfterResize = items.map((i) => (patches[i.id] ? { ...i, ...patches[i.id] } : i));
        Object.assign(patches, layoutColumn(itemsAfterResize, columnId));
      }
      dispatch({ type: 'COMMIT_ITEMS', patches });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
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
      // ease onto the common 15° stops without locking free rotation out
      const stop = Math.round(angle / 15) * 15;
      lastRotation = Math.round(Math.abs(angle - stop) < 4 ? stop : angle);
      dispatch({ type: 'UPDATE_ITEMS', patches: { [item.id]: { rotation: lastRotation } } });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dispatch({ type: 'COMMIT_ITEMS', patches: { [item.id]: { rotation: lastRotation } } });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ---- touch: pinch to zoom, two-finger pan ----
  const trackTouch = (e) => {
    const touches = touchesRef.current;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && !pinchRef.current) {
      const [a, b] = [...touches.values()];
      const rect = containerRef.current.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      pinchRef.current = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startZoom: viewport.zoom,
        // world point under the fingers' midpoint stays put while zooming
        worldX: (mid.x - viewport.panX) / viewport.zoom,
        worldY: (mid.y - viewport.panY) / viewport.zoom,
      };
      // any single-finger gesture that was in progress is abandoned, not committed
      dragState.current = null;
      setMarquee(null);
      setGuides([]);
      if (liveStrokeRef.current) {
        liveStrokeRef.current = null;
        setLiveStroke(null);
      }
    }
  };

  useEffect(() => {
    const onMove = (e) => {
      if (e.pointerType !== 'touch') return;
      const touches = touchesRef.current;
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (!pinch || touches.size < 2) return;
      const [a, b] = [...touches.values()];
      const rect = containerRef.current.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = clamp(pinch.startZoom * (dist / pinch.startDist), MIN_ZOOM, MAX_ZOOM);
      setViewport({ zoom, panX: mid.x - pinch.worldX * zoom, panY: mid.y - pinch.worldY * zoom });
    };
    const onUp = (e) => {
      if (e.pointerType !== 'touch') return;
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size < 2) pinchRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [containerRef, setViewport]);

  // ---- drawing ----
  const drawPointerAllowed = (e) => {
    if (e.pointerType === 'pen') {
      onDrawPenSeen?.();
      return true;
    }
    if (e.pointerType === 'touch') return !draw.penOnly;
    return e.button === 0;
  };

  // leaving draw mode ends the session: the next stroke starts a new sketch item
  useEffect(() => {
    if (!drawActive) {
      sessionItemRef.current = null;
      liveStrokeRef.current = null;
      setLiveStroke(null);
    }
  }, [drawActive]);

  const startStroke = (e) => {
    e.preventDefault();
    const p = screenToCanvas(e.clientX, e.clientY);
    const stroke = {
      color: draw.color,
      size: draw.size / viewport.zoom,
      pointerType: e.pointerType,
      points: [[p.x, p.y, e.pressure || 0.5]],
    };
    liveStrokeRef.current = stroke;
    setLiveStroke(stroke);
    const pointerId = e.pointerId;
    const onMove = (ev) => {
      const live = liveStrokeRef.current;
      if (!live || ev.pointerId !== pointerId) return;
      // coalesced events carry every sample the pen produced between frames
      const samples = ev.getCoalescedEvents?.() || [ev];
      samples.forEach((s) => {
        const q = screenToCanvas(s.clientX, s.clientY);
        live.points.push([q.x, q.y, s.pressure || 0.5]);
      });
      setLiveStroke({ ...live, points: live.points });
    };
    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const live = liveStrokeRef.current;
      liveStrokeRef.current = null;
      setLiveStroke(null);
      if (!live) return;
      if (live.points.length === 1) live.points.push([live.points[0][0] + 0.01, live.points[0][1], live.points[0][2]]);
      commitStroke(live);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const commitStroke = (stroke) => {
    const existing = sessionItemRef.current ? itemsById[sessionItemRef.current] : null;
    if (existing) {
      dispatch({ type: 'COMMIT_ITEMS', patches: { [existing.id]: appendWorldStroke(existing, stroke) } });
      return;
    }
    const item = makeItem('drawing', drawingFromWorldStrokes([stroke]));
    sessionItemRef.current = item.id;
    dispatch({ type: 'ADD_ITEM', item });
  };

  const startErase = (e) => {
    e.preventDefault();
    const pointerId = e.pointerId;
    const radius = 10 / viewport.zoom;
    const erased = new Set();
    const eraseAt = (clientX, clientY) => {
      const p = screenToCanvas(clientX, clientY);
      const patches = {};
      const deleteIds = [];
      items.forEach((it) => {
        if (it.type !== 'drawing' || it.locked || erased.has(it.id)) return;
        const hits = strokesNear(it, p.x, p.y, radius);
        if (hits.size === 0) return;
        const next = removeStrokes(it, hits);
        if (next) patches[it.id] = next;
        else deleteIds.push(it.id);
        erased.add(it.id);
      });
      if (Object.keys(patches).length) dispatch({ type: 'COMMIT_ITEMS', patches });
      if (deleteIds.length) dispatch({ type: 'DELETE_ITEMS', ids: deleteIds });
    };
    eraseAt(e.clientX, e.clientY);
    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      // one hit per item per move batch, so the reducer sees consistent state
      erased.clear();
      eraseAt(ev.clientX, ev.clientY);
    };
    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const bg = board.settings.background;
  const bgStyle = backgroundStyle(bg);
  const gridStyle = worldGridStyle(bg, board.settings.gridSize, board.settings.gridColor, viewport, viewportSize || { width: 0, height: 0 });

  return (
    <div
      className={`canvas-viewport${drawActive ? ` drawing tool-${draw.tool}` : ''}`}
      ref={containerRef}
      onPointerDown={onBackgroundPointerDown}
      style={bgStyle}
    >
      <div
        ref={worldRef}
        className="canvas-world"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          // handles, guides and badges divide by this so they keep a constant on-screen size
          '--inv-zoom': 1 / viewport.zoom,
        }}
      >
        {gridStyle && <div className="canvas-grid" style={gridStyle} />}
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
              onPointerDown={(e) => onItemPointerDown(e, item)}
              onResizeStart={onResizeStart}
              onRotateStart={onRotateStart}
            />
          ))}

        {guides.map((g) =>
          g.axis === 'x' ? (
            <div
              key={`x${g.pos}`}
              className="smart-guide vertical"
              style={{ left: g.pos, top: g.start - 16, height: g.end - g.start + 32 }}
            />
          ) : (
            <div
              key={`y${g.pos}`}
              className="smart-guide horizontal"
              style={{ top: g.pos, left: g.start - 16, width: g.end - g.start + 32 }}
            />
          )
        )}

        {sizeBadge && (
          <div className="size-badge" style={{ left: sizeBadge.x, top: sizeBadge.y + sizeBadge.height }}>
            {Math.round(sizeBadge.width)} × {Math.round(sizeBadge.height)}
          </div>
        )}

        {marquee && (
          <div
            className="marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
          />
        )}

        {liveStroke && liveStroke.points.length > 1 && (
          <svg className="live-stroke" aria-hidden="true">
            <path d={strokePath(liveStroke)} fill={liveStroke.color} />
          </svg>
        )}
      </div>

      {items.length === 0 && (
        <div className="canvas-empty">
          <span className="canvas-empty-eyebrow">Empty board</span>
          <p>Pick something from the bar above, or just paste an image, a link or a colour code.</p>
          <p className="canvas-empty-hint"><kbd>⌘ V</kbd> paste  ·  scroll to pan  ·  <kbd>Space</kbd> drag to pan  ·  <kbd>⌘</kbd> scroll to zoom</p>
        </div>
      )}

      {selectedIds.length > 0 && (
        <SelectionToolbar
          board={board}
          dispatch={dispatch}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onColorCheck={onColorCheck}
        />
      )}
    </div>
  );
}

function idAndChildren(id, items) {
  const children = items.filter((i) => i.parentId === id).map((i) => i.id);
  return [id, ...children];
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

function backgroundStyle(bg) {
  const base = { position: 'relative', overflow: 'hidden' };
  if (bg.type === 'image' && bg.imageDataUrl) {
    return { ...base, backgroundImage: `url(${bg.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (bg.type === 'color') {
    return { ...base, background: bg.color || '#ffffff' };
  }
  return { ...base, background: bg.type === 'dotted-black' ? '#111114' : 'var(--canvas-bg)' };
}

// The dot grid lives inside the zoomed world, like an endless picture behind the items: it
// pans and scales exactly with them, so it can never drift on its own. Only the part of
// the world that is on screen (plus a margin) is covered, aligned to the grid, so the
// element stays a sane size at any zoom. Under 20 % zoom it fades out.
function worldGridStyle(bg, gridSize, gridColor, viewport, viewportSize) {
  if (bg.type !== 'dotted-white' && bg.type !== 'dotted-black') return null;
  const step = Math.max(4, gridSize);
  const margin = step * 4;
  const left = Math.floor((-viewport.panX / viewport.zoom - margin) / step) * step;
  const top = Math.floor((-viewport.panY / viewport.zoom - margin) / step) * step;
  const width = Math.ceil((viewportSize.width / viewport.zoom + margin * 2) / step) * step;
  const height = Math.ceil((viewportSize.height / viewport.zoom + margin * 2) / step) * step;
  const dark = bg.type === 'dotted-black';
  const dotColor = dark ? 'rgba(255, 255, 255, 0.28)' : hexToRgba(gridColor, 0.7);
  // dot radius in world units, sized so it reads about 1 px at 75 % zoom
  const r = 0.8;
  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    backgroundImage: `radial-gradient(circle, ${dotColor} ${r}px, transparent ${r + 0.6}px)`,
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: '0 0',
    opacity: viewport.zoom < 0.2 ? 0 : 1,
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  };
}

function hexToRgba(hex, alpha) {
  const clean = (hex || '#c9c9c9').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
