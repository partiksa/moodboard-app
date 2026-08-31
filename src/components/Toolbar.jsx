import { useState } from 'react';
import {
  TextAa,
  Image,
  VideoCamera,
  File,
  LinkSimple,
  Palette,
  ListChecks,
  Columns,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlass,
  GearSix,
  Export,
  UsersThree,
  FloppyDisk,
} from './icons.jsx';
import './Toolbar.css';

const SAVE_LABELS = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  error: 'Sync failed',
  conflict: 'Sync conflict',
};

const ITEM_BUTTONS = [
  { type: 'text', label: 'Text', Icon: TextAa },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'video', label: 'Video', Icon: VideoCamera },
  { type: 'attachment', label: 'File', Icon: File },
  { type: 'url', label: 'Link', Icon: LinkSimple },
  { type: 'color', label: 'Color', Icon: Palette },
  { type: 'todo', label: 'To-do', Icon: ListChecks },
  { type: 'column', label: 'Section', Icon: Columns },
];

export default function Toolbar({
  boardName,
  onAddItem,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  search,
  onSearchChange,
  onOpenSettings,
  onOpenExport,
  saveState,
  onSave,
  collaboratorName,
  onChangeName,
  onToggleActivity,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(collaboratorName || '');

  const commitName = () => {
    setEditingName(false);
    if (nameDraft.trim()) onChangeName?.(nameDraft.trim());
    else setNameDraft(collaboratorName || '');
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="board-title">{boardName}</span>
        <button
          className="tool-btn primary"
          onClick={onSave}
          disabled={saveState === 'saving' || saveState === 'saved' || saveState === 'conflict'}
          title="Save (Ctrl/Cmd+S)"
        >
          <FloppyDisk size={14} weight="bold" /> Save
        </button>
        <span className={`save-indicator save-${saveState}`}>{SAVE_LABELS[saveState] || 'Saved'}</span>
      </div>

      <div className="toolbar-group">
        {ITEM_BUTTONS.map(({ type, label, Icon }) => (
          <button key={type} className="tool-btn" onClick={() => onAddItem(type)}>
            <Icon size={14} weight="bold" /> {label}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button className="tool-btn icon-only" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <ArrowCounterClockwise size={14} weight="bold" />
        </button>
        <button className="tool-btn icon-only" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <ArrowClockwise size={14} weight="bold" />
        </button>
        <div className="search-box">
          <MagnifyingGlass size={13} weight="bold" />
          <input
            className="search-input"
            placeholder="Search board…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button className="tool-btn" onClick={onOpenSettings}>
          <GearSix size={14} weight="bold" /> Settings
        </button>
        <button className="tool-btn primary" onClick={onOpenExport}>
          <Export size={14} weight="bold" /> Export
        </button>
      </div>

      <div className="toolbar-group">
        <button className="tool-btn" onClick={onToggleActivity} title="Activity history">
          <UsersThree size={14} weight="bold" /> Activity
        </button>
        {editingName ? (
          <input
            className="name-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
        ) : (
          <button className="collaborator-chip" onClick={() => setEditingName(true)} title="Change your display name">
            {collaboratorName || 'Anonymous'}
          </button>
        )}
      </div>
    </div>
  );
}
