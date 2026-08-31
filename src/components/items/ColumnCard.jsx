import { useState } from 'react';
import { makeItem } from '../../state/boardModel';
import { COLUMN_PADDING, nextChildY } from '../../utils/columnLayout';
import { Plus, TextAa, Image, VideoCamera, File, LinkSimple, Palette, ListChecks } from '../icons.jsx';

const DEFAULT_CHILD_HEIGHT = { color: 120, url: 96, attachment: 64, todo: 140, text: 110 };

const ADD_OPTIONS = [
  { type: 'text', label: 'Text', Icon: TextAa },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'video', label: 'Video', Icon: VideoCamera },
  { type: 'attachment', label: 'File', Icon: File },
  { type: 'url', label: 'Link', Icon: LinkSimple },
  { type: 'color', label: 'Color', Icon: Palette },
  { type: 'todo', label: 'To-do', Icon: ListChecks },
];

export default function ColumnCard({ item, board, dispatch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
  const hasChildren = board.items.some((i) => i.parentId === item.id);

  const addChild = (type) => {
    const child = makeItem(type, {
      x: item.x + COLUMN_PADDING,
      y: nextChildY(board.items, item), // appended below the current children, not on top of them
      width: item.width - COLUMN_PADDING * 2,
      height: DEFAULT_CHILD_HEIGHT[type] || 120,
      parentId: item.id,
    });
    dispatch({ type: 'ADD_ITEM', item: child });
    setMenuOpen(false);
  };

  return (
    <div className="column-card">
      <div className="column-header" onMouseDown={(e) => e.stopPropagation()}>
        <div
          className="column-label"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => update({ label: e.currentTarget.textContent })}
        >
          {item.label}
        </div>
        <div className="column-add-wrap">
          <button
            className="column-add-btn"
            title="Add item to this column"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Plus size={13} weight="bold" />
          </button>
          {menuOpen && (
            <>
              <div className="column-add-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="column-add-menu">
                {ADD_OPTIONS.map(({ type, label, Icon }) => (
                  <button key={type} onClick={() => addChild(type)}>
                    <Icon size={14} weight="bold" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {!hasChildren && <div className="column-drop-hint">Drop items here</div>}
    </div>
  );
}
