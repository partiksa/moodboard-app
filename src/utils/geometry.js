// Snap a candidate position to the grid or to alignment guides against other items,
// but only when within `snapDistance` of a snap line — this keeps free placement the default.
export function computeSnap(rect, otherRects, gridSize, snapDistance) {
  let dx = 0;
  let dy = 0;
  let guideX = null;
  let guideY = null;

  const candidatesX = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  const candidatesY = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

  const gridLinesX = nearestGridLines(candidatesX, gridSize);
  const gridLinesY = nearestGridLines(candidatesY, gridSize);

  let bestX = { dist: snapDistance, delta: 0, line: null };
  let bestY = { dist: snapDistance, delta: 0, line: null };

  gridLinesX.forEach(({ candidate, line }) => {
    const dist = Math.abs(candidate - line);
    if (dist < bestX.dist) bestX = { dist, delta: line - candidate, line };
  });
  gridLinesY.forEach(({ candidate, line }) => {
    const dist = Math.abs(candidate - line);
    if (dist < bestY.dist) bestY = { dist, delta: line - candidate, line };
  });

  for (const other of otherRects) {
    const otherXs = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherYs = [other.y, other.y + other.height / 2, other.y + other.height];
    for (const cx of candidatesX) {
      for (const ox of otherXs) {
        const dist = Math.abs(cx - ox);
        if (dist < bestX.dist) bestX = { dist, delta: ox - cx, line: ox };
      }
    }
    for (const cy of candidatesY) {
      for (const oy of otherYs) {
        const dist = Math.abs(cy - oy);
        if (dist < bestY.dist) bestY = { dist, delta: oy - cy, line: oy };
      }
    }
  }

  if (bestX.line !== null) {
    dx = bestX.delta;
    guideX = bestX.line;
  }
  if (bestY.line !== null) {
    dy = bestY.delta;
    guideY = bestY.line;
  }

  return { dx, dy, guideX, guideY };
}

function nearestGridLines(candidates, gridSize) {
  return candidates.map((candidate) => ({
    candidate,
    line: Math.round(candidate / gridSize) * gridSize,
  }));
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
