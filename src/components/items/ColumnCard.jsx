export default function ColumnCard({ item, dispatch }) {
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
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
      <div className="column-drop-hint">Drop items here to group them</div>
    </div>
  );
}
