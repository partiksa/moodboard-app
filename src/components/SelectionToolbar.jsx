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
      <span className="selection-count">{selectedItems.length === 1 ? '1 item' : `${selectedItems.length} items`}</span>
      <button className="tip tip-top" data-tip="Bring to front" onClick={bringToFront} aria-label="Bring to front"><ArrowLineUp size={15} weight="regular" /></button>
      <button className="tip tip-top" data-tip="Send to back" onClick={sendToBack} aria-label="Send to back"><ArrowLineDown size={15} weight="regular" /></button>
      <button className="tip tip-top" data-tip={anyLocked ? 'Unlock' : 'Lock in place'} onClick={toggleLock} aria-label={anyLocked ? 'Unlock' : 'Lock'}>
        {anyLocked ? <LockSimpleOpen size={15} weight="regular" /> : <LockSimple size={15} weight="regular" />}
      </button>
      <button className="tip tip-top" data-tip="Duplicate" data-kbd="⌘ D" onClick={duplicate} aria-label="Duplicate"><CopySimple size={15} weight="regular" /></button>
      {selectedItems.length > 1 && (
        <button className="tip tip-top" data-tip={anyGrouped ? 'Ungroup' : 'Group'} data-kbd="⌘ G" onClick={anyGrouped ? ungroup : group} aria-label="Group or ungroup">
          <UsersThree size={15} weight="regular" />
        </button>
      )}
      {single && (
        <button className={`tip tip-top${noteOpen ? ' active' : ''}`} data-tip="Private note" onClick={() => setNoteOpen((o) => !o)} aria-label="Private note"><NotePencil size={15} weight="regular" /></button>
      )}
      <button className="danger tip tip-top" data-tip="Delete" data-kbd="⌫" onClick={remove} aria-label="Delete"><TrashSimple size={15} weight="regular" /></button>

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
