import { useMemo } from 'react';
import { strokePath } from '../../utils/drawing';

// A sketch made with the drawing tool. The SVG stretches with the item, so resizing scales
// the strokes like an image would.
export default function DrawingCard({ item }) {
  const paths = useMemo(
    () => item.strokes.map((s, i) => ({ key: i, d: strokePath(s), color: s.color })),
    [item.strokes]
  );
  return (
    <svg
      className="drawing-card"
      viewBox={`0 0 ${item.localWidth} ${item.localHeight}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
    >
      {paths.map((p) => <path key={p.key} d={p.d} fill={p.color} />)}
    </svg>
  );
}
