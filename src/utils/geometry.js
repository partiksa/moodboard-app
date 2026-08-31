// Illustrator/Figma-style smart guides: an item snaps to the edges and centres of the
// other items on the board, and every alignment that ends up matching is reported back as
// a guide segment that spans only the items involved (not an infinite line across the canvas).

const EPS = 0.5;

function linesOf(r, axis) {
  const base = axis === 'x' ? r.x : r.y;
  const size = axis === 'x' ? r.width : r.height;
  return [base, base + size / 2, base + size];
}

function bestDelta(rect, others, axis, gridSize, snapDistance) {
  const self = linesOf(rect, axis);
  let best = null;
  for (const o of others) {
    for (const line of linesOf(o, axis)) {
      for (const s of self) {
        const dist = Math.abs(s - line);
        if (dist <= snapDistance && (!best || dist < best.dist)) best = { dist, delta: line - s };
      }
    }
  }
  // The grid is only a fallback: aligning to a real item always wins over aligning to the grid.
  if (!best && gridSize > 0) {
    for (const s of self) {
      const line = Math.round(s / gridSize) * gridSize;
      const dist = Math.abs(s - line);
      if (dist <= snapDistance && (!best || dist < best.dist)) best = { dist, delta: line - s };
    }
  }
  return best ? best.delta : 0;
}

function collectGuides(rect, others, axis) {
  const selfLines = linesOf(rect, axis);
  const guides = [];
  for (const o of others) {
    for (const line of linesOf(o, axis)) {
      if (!selfLines.some((s) => Math.abs(s - line) < EPS)) continue;
      const start = axis === 'x' ? Math.min(rect.y, o.y) : Math.min(rect.x, o.x);
      const end =
        axis === 'x'
          ? Math.max(rect.y + rect.height, o.y + o.height)
          : Math.max(rect.x + rect.width, o.x + o.width);
      const existing = guides.find((g) => Math.abs(g.pos - line) < EPS);
      if (existing) {
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
      } else {
        guides.push({ axis, pos: line, start, end });
      }
    }
  }
  return guides;
}

export function guidesForRect(rect, others) {
  return [...collectGuides(rect, others, 'x'), ...collectGuides(rect, others, 'y')];
}

export function computeSmartGuides(rect, others, gridSize, snapDistance) {
  if (!(snapDistance > 0)) return { dx: 0, dy: 0, guides: [] };
  const dx = bestDelta(rect, others, 'x', gridSize, snapDistance);
  const dy = bestDelta(rect, others, 'y', gridSize, snapDistance);
  const moved = { ...rect, x: rect.x + dx, y: rect.y + dy };
  return { dx, dy, guides: guidesForRect(moved, others) };
}

function nearestLine(value, others, axis, snapDistance) {
  let best = null;
  for (const o of others) {
    for (const line of linesOf(o, axis)) {
      const dist = Math.abs(value - line);
      if (dist <= snapDistance && (!best || dist < best.dist)) best = { dist, line };
    }
  }
  return best ? best.line : null;
}

// Snaps only the edges actually being dragged by a resize handle, so resizing lines an item
// up with its neighbours the same way dragging it does.
export function snapResizeRect(rect, handle, others, snapDistance) {
  const r = { ...rect };
  if (!(snapDistance > 0)) return r;

  if (handle.includes('e')) {
    const line = nearestLine(r.x + r.width, others, 'x', snapDistance);
    if (line !== null) r.width = Math.max(40, line - r.x);
  }
  if (handle.includes('w')) {
    const line = nearestLine(r.x, others, 'x', snapDistance);
    if (line !== null) {
      const right = r.x + r.width;
      r.x = Math.min(line, right - 40);
      r.width = right - r.x;
    }
  }
  if (handle.includes('s')) {
    const line = nearestLine(r.y + r.height, others, 'y', snapDistance);
    if (line !== null) r.height = Math.max(30, line - r.y);
  }
  if (handle.includes('n')) {
    const line = nearestLine(r.y, others, 'y', snapDistance);
    if (line !== null) {
      const bottom = r.y + r.height;
      r.y = Math.min(line, bottom - 30);
      r.height = bottom - r.y;
    }
  }
  return r;
}

export function rotatePoint(px, py, cx, cy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
