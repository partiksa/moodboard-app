import { useState } from 'react';
import { uid } from '../utils/id';
import {
  LockSimple,
  LockSimpleOpen,
  CopySimple,
  UsersThree,
  NotePencil,
  TrashSimple,
  Minus,
  Plus,
} from './icons.jsx';
import './SelectionToolbar.css';

export default function SelectionToolbar({ board, dispatch, selectedIds, setSelectedIds, grid, changeSpan }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const items = board.items;
  const selectedItems = items.filter((i) => selectedIds.includes(i.id));
  const single = selectedItems.length === 1 ? selectedItems[0] : null;
  const anyLocked = selectedItems.some((i) => i.locked);
  const anyGrouped = selectedItems.some((i) => i.groupId);

  const toggleLock = () => {
    const patches = {};
    selectedItems.forEach((i) => (patches[i.id] = { locked: !anyLocked }));
    dispatch({ type: 'COMMIT_ITEMS', patches });
  };

  const duplicate = () => {
    const clones = selectedItems.map((i) => ({ ...i, id: uid('item') }));
    const lastIndex = Math.max(...selectedItems.map((i) => items.indexOf(i)));
    const afterId = items[lastIndex]?.id;
    dispatch({ type: 'DUPLICATE_ITEMS', items: clones, afterId });
    setSelectedIds(clones.map((c) => c.id));
  };

  const remove = () => {
    dispatch({ type: 'DELETE_ITEMS', ids: selectedIds });
    setSelectedIds([]);
  };

  const group = () => {
    if (selectedItems.length < 2) return;
    const groupId = uid('group');
    const patches = {};
    selectedItems.forEach((i) => (patches[i.id] = { groupId }));
    dispatch({ type: 'COMMIT_ITEMS', patches });
  };

  const ungroup = () => {
    const patches = {};
    selectedItems.forEach((i) => (patches[i.id] = { groupId: null }));
    dispatch({ type: 'COMMIT_ITEMS', patches });
  };

  return (
    <div className="selection-toolbar">
      {single && grid && (() => {
        const colSpan = single.colSpan || 1;
        const rowSpan = single.rowSpan || 1;
        return (
          <>
            <div className="span-control" title="Columns wide">
              <button onClick={() => changeSpan(single.id, { colSpan: colSpan - 1 })} disabled={colSpan <= 1}>
                <Minus size={11} weight="bold" />
              </button>
              <span>{colSpan}w</span>
              <button onClick={() => changeSpan(single.id, { colSpan: colSpan + 1 })} disabled={colSpan >= grid.columns}>
                <Plus size={11} weight="bold" />
              </button>
            </div>
            <div className="span-control" title="Rows tall">
              <button onClick={() => changeSpan(single.id, { rowSpan: rowSpan - 1 })} disabled={rowSpan <= 1}>
                <Minus size={11} weight="bold" />
              </button>
              <span>{rowSpan}h</span>
              <button onClick={() => changeSpan(single.id, { rowSpan: rowSpan + 1 })} disabled={rowSpan >= 4}>
                <Plus size={11} weight="bold" />
              </button>
            </div>
          </>
        );
      })()}
      <button onClick={toggleLock} title={anyLocked ? 'Unlock' : 'Lock'}>
        {anyLocked ? <LockSimpleOpen size={14} weight="bold" /> : <LockSimple size={14} weight="bold" />}
      </button>
      <button onClick={duplicate} title="Duplicate (Ctrl+D)"><CopySimple size={14} weight="bold" /></button>
      {selectedItems.length > 1 && (
        <button onClick={anyGrouped ? ungroup : group} title="Group/Ungroup (Ctrl+G)">
          <UsersThree size={14} weight="bold" />
        </button>
      )}
      {single && (
        <button onClick={() => setNoteOpen((o) => !o)} title="Private note"><NotePencil size={14} weight="bold" /></button>
      )}
      <button onClick={remove} title="Delete" className="danger"><TrashSimple size={14} weight="bold" /></button>

      {noteOpen && single && (
        <div className="private-note-editor">
          <textarea
            placeholder="Private note (excluded from export by default)"
            value={single.privateNote || ''}
            onChange={(e) => dispatch({ type: 'UPDATE_ITEM', id: single.id, patch: { privateNote: e.target.value } })}
          />
        </div>
      )}
    </div>
  );
}
