export default function ColumnCard({ item, board, dispatch }) {
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
  const hasChildren = board.items.some((i) => i.parentId === item.id);
  return (
    <div className="column-card">
      <div
        className="column-label"
        contentEditable
        suppressContentEditableWarning
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={(e) => update({ label: e.currentTarget.textContent })}
      >
        {item.label}
      </div>
      {!hasChildren && <div className="column-drop-hint">Drop items here to group them</div>}
    </div>
  );
}
