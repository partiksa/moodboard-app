import { useMemo, useRef } from 'react';
import './MiniMap.css';

const MAP_WIDTH = 180;
const MAP_HEIGHT = 120;
const PADDING = 200;

export default function MiniMap({ board, viewport, setViewport, viewportSize }) {
  const ref = useRef(null);
  const items = board.items;

  const bounds = useMemo(() => {
    if (items.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    const minX = Math.min(...items.map((i) => i.x)) - PADDING;
    const minY = Math.min(...items.map((i) => i.y)) - PADDING;
    const maxX = Math.max(...items.map((i) => i.x + i.width)) + PADDING;
    const maxY = Math.max(...items.map((i) => i.y + i.height)) + PADDING;
    return { minX, minY, maxX, maxY };
  }, [items]);

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(MAP_WIDTH / worldWidth, MAP_HEIGHT / worldHeight);

  const toMap = (x, y) => ({ x: (x - bounds.minX) * scale, y: (y - bounds.minY) * scale });

  const viewX = -viewport.panX / viewport.zoom;
  const viewY = -viewport.panY / viewport.zoom;
  const viewW = viewportSize.width / viewport.zoom;
  const viewH = viewportSize.height / viewport.zoom;
  const viewTopLeft = toMap(viewX, viewY);

  const jumpTo = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = bounds.minX + mx / scale;
    const worldY = bounds.minY + my / scale;
    setViewport((v) => ({
      ...v,
      panX: viewportSize.width / 2 - worldX * v.zoom,
      panY: viewportSize.height / 2 - worldY * v.zoom,
    }));
  };

  return (
    <div className="minimap" ref={ref} onClick={jumpTo}>
      {items.map((item) => {
        const pos = toMap(item.x, item.y);
        return (
          <div
            key={item.id}
            className="minimap-item"
            style={{ left: pos.x, top: pos.y, width: Math.max(2, item.width * scale), height: Math.max(2, item.height * scale) }}
          />
        );
      })}
      <div
        className="minimap-viewport"
        style={{ left: viewTopLeft.x, top: viewTopLeft.y, width: viewW * scale, height: viewH * scale }}
      />
    </div>
  );
}
