import { useState } from 'react';
import { uid } from '../utils/id';
import {
  ArrowLineUp,
  ArrowLineDown,
  LockSimple,
  LockSimpleOpen,
  CopySimple,
  UsersThree,
  NotePencil,
  TrashSimple,
} from './icons.jsx';
import './SelectionToolbar.css';

export default function SelectionToolbar({ board, dispatch, selectedIds, setSelectedIds }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const items = board.items;
  const selectedItems = items.filter((i) => selectedIds.includes(i.id));
  const single = selectedItems.length === 1 ? selectedItems[0] : null;
  const anyLocked = selectedItems.some((i) => i.locked);
  const anyGrouped = selectedItems.some((i) => i.groupId);

  const bringToFront = () => dispatch({ type: 'BRING_TO_FRONT', ids: selectedIds });
  const sendToBack = () => dispatch({ type: 'SEND_TO_BACK', ids: selectedIds });

  const toggleLock = () => {
    const patches = {};
    selectedItems.forEach((i) => (patches[i.id] = { locked: !anyLocked }));
    dispatch({ type: 'COMMIT_ITEMS', patches });
  };

  const duplicate = () => {
    const idMap = {};
    const clones = selectedItems.map((i) => {
      const newId = uid('item');
      idMap[i.id] = newId;
      return { ...i, id: newId, x: i.x + 24, y: i.y + 24 };
    });
    clones.forEach((c) => {
      if (c.parentId && idMap[c.parentId]) c.parentId = idMap[c.parentId];
    });
    dispatch({ type: 'DUPLICATE_ITEMS', items: clones });
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
      <button onClick={bringToFront} title="Bring to front"><ArrowLineUp size={14} weight="bold" /></button>
      <button onClick={sendToBack} title="Send to back"><ArrowLineDown size={14} weight="bold" /></button>
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
