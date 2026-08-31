export const COLUMN_PADDING = 12;
export const COLUMN_LABEL_HEIGHT = 56;
export const COLUMN_GAP = 10;

// Stacks a column's children vertically inside it, fitting them to its inner width and
// growing the column to fit. Children are ordered by their vertical position, so dragging
// one up or down inside the column reorders it.
export function layoutColumn(items, columnId) {
  const column = items.find((i) => i.id === columnId && i.type === 'column');
  if (!column) return {};
  const children = items.filter((i) => i.parentId === columnId).sort((a, b) => a.y - b.y);
  const patches = {};
  const innerWidth = Math.max(40, column.width - COLUMN_PADDING * 2);
  let cursorY = column.y + COLUMN_LABEL_HEIGHT;

  children.forEach((child) => {
    // images keep their aspect ratio so they never get squashed; everything else keeps the
    // height it was given, because a text or to-do card has no meaningful ratio
    const height =
      child.type === 'image' && child.naturalWidth && child.naturalHeight
        ? Math.max(30, Math.round((innerWidth * child.naturalHeight) / child.naturalWidth))
        : Math.max(30, Math.round(child.height));
    patches[child.id] = { x: column.x + COLUMN_PADDING, y: cursorY, width: innerWidth, height };
    cursorY += height + COLUMN_GAP;
  });

  const contentHeight = children.length ? cursorY - column.y - COLUMN_GAP + COLUMN_PADDING : column.height;
  patches[column.id] = { height: Math.max(160, contentHeight) };
  return patches;
}

// Y coordinate a newly added child should start at so it lands after the existing ones.
export function nextChildY(items, column) {
  const children = items.filter((i) => i.parentId === column.id);
  if (!children.length) return column.y + COLUMN_LABEL_HEIGHT;
  return Math.max(...children.map((c) => c.y + c.height)) + COLUMN_GAP;
}
