export const COLUMN_PADDING = 12;
export const COLUMN_LABEL_HEIGHT = 56;
export const COLUMN_GAP = 10;

// Stacks a column's children vertically inside it, fitting them to its inner width
// (preserving aspect ratio for images) and growing the column to fit their total height.
export function layoutColumn(items, columnId) {
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
