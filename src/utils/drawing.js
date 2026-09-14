// Freehand strokes for the drawing tool. A drawing item keeps its strokes in a local box
// (0..localWidth × 0..localHeight); the item's on-board width/height scale that box, so
// resizing the item stretches the sketch like an image.
import { getStroke } from 'perfect-freehand';

export const STROKE_PAD = 12;

export function strokeOptions(size, pointerType) {
  return {
    size,
    thinning: pointerType === 'pen' ? 0.6 : 0.35,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: pointerType !== 'pen',
    last: true,
  };
}

// perfect-freehand returns an outline polygon; this turns it into a closed SVG path.
export function outlinePath(points) {
  if (!points.length) return '';
  const d = [];
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    if (i === 0) d.push(`M ${x0.toFixed(2)} ${y0.toFixed(2)}`);
    d.push(`Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`);
  }
  d.push('Z');
  return d.join(' ');
}

export function strokePath(stroke) {
  return outlinePath(getStroke(stroke.points, strokeOptions(stroke.size, stroke.pointerType)));
}

function strokeBounds(stroke) {
  const pad = stroke.size / 2 + STROKE_PAD;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  stroke.points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function unionBounds(strokes) {
  return strokes.map(strokeBounds).reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

// Builds a fresh drawing item from strokes given in world coordinates.
export function drawingFromWorldStrokes(strokes) {
  const b = unionBounds(strokes);
  const localWidth = Math.max(1, b.maxX - b.minX);
  const localHeight = Math.max(1, b.maxY - b.minY);
  return {
    x: b.minX,
    y: b.minY,
    width: localWidth,
    height: localHeight,
    localWidth,
    localHeight,
    strokes: strokes.map((s) => ({ ...s, points: s.points.map(([x, y, p]) => [x - b.minX, y - b.minY, p]) })),
  };
}

// Converts an item's strokes back to world coordinates (honouring any resize the user did).
export function strokesToWorld(item) {
  const sx = item.width / item.localWidth;
  const sy = item.height / item.localHeight;
  return item.strokes.map((s) => ({
    ...s,
    // a stretched sketch keeps its stretch: the stroke size follows the average scale
    size: s.size * ((sx + sy) / 2),
    points: s.points.map(([x, y, p]) => [item.x + x * sx, item.y + y * sy, p]),
  }));
}

// Returns a patch that adds a world-space stroke to an existing drawing item, growing its
// box when the stroke runs outside it.
export function appendWorldStroke(item, stroke) {
  return drawingFromWorldStrokes([...strokesToWorld(item), stroke]);
}

export function removeStrokes(item, indexes) {
  const keep = strokesToWorld(item).filter((_, i) => !indexes.has(i));
  if (keep.length === 0) return null;
  return drawingFromWorldStrokes(keep);
}

// Indexes of strokes passing within `radius` (world units) of a world point.
export function strokesNear(item, wx, wy, radius) {
  const hits = new Set();
  strokesToWorld(item).forEach((s, i) => {
    const r = radius + s.size / 2;
    for (let k = 0; k < s.points.length; k++) {
      const [x, y] = s.points[k];
      if ((x - wx) ** 2 + (y - wy) ** 2 <= r * r) { hits.add(i); return; }
      if (k > 0) {
        // also check the segment between consecutive samples so fast strokes can be hit
        const [px, py] = s.points[k - 1];
        const dx = x - px, dy = y - py;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((wx - px) * dx + (wy - py) * dy) / len2));
        const cx = px + dx * t, cy = py + dy * t;
        if ((cx - wx) ** 2 + (cy - wy) ** 2 <= r * r) { hits.add(i); return; }
      }
    }
  });
  return hits;
}
