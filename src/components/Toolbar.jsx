import { useCallback, useEffect, useRef, useState } from 'react';
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
  Minus,
  Plus,
  GearSix,
  Export,
  UsersThree,
  FloppyDisk,
  DotsSixVertical,
  PencilSimple,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
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
  { type: 'text', label: 'Text', hint: 'Notes, headings, lists', Icon: TextAa },
  { type: 'image', label: 'Image', hint: 'Upload or paste', Icon: Image },
  { type: 'video', label: 'Video', hint: 'Short clips', Icon: VideoCamera },
  { type: 'attachment', label: 'File', hint: 'PDF, ZIP, anything', Icon: File },
  { type: 'url', label: 'Link', hint: 'Web page preview', Icon: LinkSimple },
  { type: 'color', label: 'Color', hint: 'Swatch with HEX, RGB, CMYK', Icon: Palette },
  { type: 'todo', label: 'To-do', hint: 'Checklist', Icon: ListChecks },
  { type: 'column', label: 'Column', hint: 'Group items in a stack', Icon: Columns },
];

// The bar can be parked in three places; the choice and its hidden state survive reloads.
const DOCK_KEY = 'moodboard-toolbar-dock';
const DOCKS = ['top', 'bottom', 'left', 'right'];

function loadDock() {
  try {
    const saved = JSON.parse(localStorage.getItem(DOCK_KEY) || '{}');
    return {
      dock: DOCKS.includes(saved.dock) ? saved.dock : 'top',
      collapsed: Boolean(saved.collapsed),
    };
  } catch {
    return { dock: 'top', collapsed: false };
  }
}

function saveDock(state) {
  try {
    localStorage.setItem(DOCK_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

// Nearest edge for a pointer position inside the editor area; the bar always sits centred on it.
function dockForPoint(x, y, width, height) {
  const d = { top: y, bottom: height - y, left: x, right: width - x };
  return Object.keys(d).reduce((best, k) => (d[k] < d[best] ? k : best), 'top');
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export default function Toolbar({
  boardName,
  onRenameBoard,
  onAddItem,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  search,
  onSearchChange,
  onOpenSettings,
  onOpenExport,
  zoom,
  onZoomIn,
  onZoomOut,
  saveState,
  saveError,
  onSave,
  collaboratorName,
  onChangeName,
  onToggleActivity,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(collaboratorName || '');
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardDraft, setBoardDraft] = useState(boardName);

  const commitBoardName = () => {
    setEditingBoardName(false);
    const next = boardDraft.trim();
    if (next && next !== boardName) onRenameBoard?.(next);
    else setBoardDraft(boardName);
  };

  const commitName = () => {
    setEditingName(false);
    if (nameDraft.trim()) onChangeName?.(nameDraft.trim());
    else setNameDraft(collaboratorName || '');
  };

  const [{ dock, collapsed }, setDockState] = useState(loadDock);
  const [drag, setDrag] = useState(null); // { x, y, target } while the grip is held
  // hovering the orb peeks the bar out, but not right after the hide click while the
  // pointer is still over it (that is why the hide arrow looked dead)
  const [peekBlocked, setPeekBlocked] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const vertical = dock === 'left' || dock === 'right';
  const barRef = useRef(null);

  const updateDock = useCallback((patch) => {
    setDockState((prev) => {
      const next = { ...prev, ...patch };
      saveDock(next);
      return next;
    });
  }, []);

  const onGripMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const bar = barRef.current;
    const area = bar?.parentElement;
    if (!bar || !area) return;
    const areaRect = area.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const grabX = e.clientX - barRect.left;
    const grabY = e.clientY - barRect.top;
    const place = (ev) => {
      const px = ev.clientX - areaRect.left;
      const py = ev.clientY - areaRect.top;
      return {
        x: px - grabX,
        y: py - grabY,
        target: dockForPoint(px, py, areaRect.width, areaRect.height),
      };
    };
    setDrag(place(e));
    const onMove = (ev) => setDrag(place(ev));
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const final = place(ev);
      setDrag(null);
      updateDock({ dock: final.target, collapsed: false });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const hide = () => {
    setPeekBlocked(true);
    updateDock({ collapsed: true });
  };
  const show = () => {
    setPeekBlocked(false);
    updateDock({ collapsed: false });
  };

  // arrow direction follows the edge the bar hides towards
  const ARROWS = {
    top: [CaretUp, CaretDown],
    bottom: [CaretDown, CaretUp],
    left: [CaretLeft, CaretRight],
    right: [CaretRight, CaretLeft],
  };
  const [HideIcon, ShowIcon] = ARROWS[dock] || ARROWS.top;

  const classes = ['toolbar', `dock-${dock}`];
  if (vertical) classes.push('vertical');
  if (collapsed) classes.push('collapsed');
  if (peekBlocked) classes.push('no-peek');
  if (drag) classes.push('dragging');

  const iconSize = 17;

  return (
    <>
    {drag && DOCKS.map((d) => (
      <div key={d} className={`toolbar-snap-zone zone-${d}${drag.target === d ? ' active' : ''}`} />
    ))}
    <div
      ref={barRef}
      className={classes.join(' ')}
      style={drag ? { left: drag.x, top: drag.y, right: 'auto', bottom: 'auto', transform: 'none' } : undefined}
      onMouseLeave={() => setPeekBlocked(false)}
    >
      <button type="button" className="toolbar-orb" aria-label="Show toolbar" onClick={show}>
        <DotsSixVertical size={16} weight="bold" />
      </button>

      <div className="toolbar-body">
      <button
        type="button"
        className="toolbar-grip tip"
        data-tip="Drag to move"
        aria-label="Move toolbar"
        onMouseDown={onGripMouseDown}
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      <div className="toolbar-group">
        {editingBoardName ? (
          <input
            className="board-title-input"
            autoFocus
            value={boardDraft}
            onChange={(e) => setBoardDraft(e.target.value)}
            onBlur={commitBoardName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitBoardName();
              if (e.key === 'Escape') { setBoardDraft(boardName); setEditingBoardName(false); }
            }}
          />
        ) : vertical ? (
          <button
            className="tool-btn icon-only tip"
            data-tip={`Rename "${boardName}"`}
            aria-label="Rename board"
            onClick={() => { setBoardDraft(boardName); setEditingBoardName(true); }}
          >
            <PencilSimple size={iconSize} weight="regular" />
          </button>
        ) : (
          <button
            className="board-title tip"
            data-tip="Rename board"
            onClick={() => { setBoardDraft(boardName); setEditingBoardName(true); }}
          >
            {boardName}
          </button>
        )}
        <span className={`save-pill save-${saveState} tip`} data-tip={saveError || SAVE_LABELS[saveState] || 'Saved'}>
          <span className="save-dot" />
          {!vertical && <span className="save-label">{SAVE_LABELS[saveState] || 'Saved'}</span>}
        </span>
        {saveState !== 'saved' && saveState !== 'saving' && (
          <button className="tool-btn icon-only tip" data-tip="Save now" data-kbd={`${MOD} S`} onClick={onSave}>
            <FloppyDisk size={15} weight="regular" />
          </button>
        )}
      </div>

      <div className="toolbar-group item-buttons">
        {ITEM_BUTTONS.map(({ type, label, hint, Icon }) => (
          <button
            key={type}
            className="tool-btn icon-only tip tip-rich"
            data-tip={label}
            data-hint={hint}
            onClick={() => onAddItem(type)}
            aria-label={`Add ${label.toLowerCase()}`}
          >
            <Icon size={iconSize} weight="regular" />
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button className="tool-btn icon-only tip" data-tip="Undo" data-kbd={`${MOD} Z`} onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          <ArrowCounterClockwise size={15} weight="regular" />
        </button>
        <button className="tool-btn icon-only tip" data-tip="Redo" data-kbd={`${MOD} ⇧ Z`} onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          <ArrowClockwise size={15} weight="regular" />
        </button>

        {vertical ? (
          <div className="search-popover-anchor">
            <button
              className={`tool-btn icon-only tip${search || searchOpen ? ' active' : ''}`}
              data-tip="Search board"
              aria-label="Search board"
              onClick={() => setSearchOpen((o) => !o)}
            >
              <MagnifyingGlass size={iconSize} weight="regular" />
            </button>
            {searchOpen && (
              <div className="search-popover">
                <MagnifyingGlass size={14} weight="regular" />
                <input
                  className="search-input"
                  autoFocus
                  placeholder="Search board…"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { onSearchChange(''); setSearchOpen(false); }
                    if (e.key === 'Enter') setSearchOpen(false);
                  }}
                  onBlur={() => { if (!search) setSearchOpen(false); }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="search-box">
            <MagnifyingGlass size={14} weight="regular" />
            <input
              className="search-input"
              placeholder="Search board…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {vertical ? (
          <>
            <button className="tool-btn icon-only tip" data-tip={`Zoom in · ${Math.round(zoom * 100)}%`} data-kbd={`${MOD} +`} onClick={onZoomIn} aria-label="Zoom in">
              <Plus size={14} weight="bold" />
            </button>
            <button className="tool-btn icon-only tip" data-tip={`Zoom out · ${Math.round(zoom * 100)}%`} data-kbd={`${MOD} −`} onClick={onZoomOut} aria-label="Zoom out">
              <Minus size={14} weight="bold" />
            </button>
          </>
        ) : (
          <div className="zoom-controls">
            <button className="tip" data-tip="Zoom out" data-kbd={`${MOD} −`} onClick={onZoomOut} aria-label="Zoom out">
              <Minus size={12} weight="bold" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="tip" data-tip="Zoom in" data-kbd={`${MOD} +`} onClick={onZoomIn} aria-label="Zoom in">
              <Plus size={12} weight="bold" />
            </button>
          </div>
        )}

        <button className="tool-btn icon-only tip" data-tip="Board settings" onClick={onOpenSettings} aria-label="Board settings">
          <GearSix size={iconSize} weight="regular" />
        </button>

        {vertical ? (
          <button className="tool-btn icon-only primary tip" data-tip="Export" onClick={onOpenExport} aria-label="Export">
            <Export size={15} weight="bold" />
          </button>
        ) : (
          <button className="tool-btn primary tip" data-tip="PNG, JPG, PDF or Markdown" onClick={onOpenExport}>
            Export
            <span className="btn-orb"><Export size={12} weight="bold" /></span>
          </button>
        )}
      </div>

      <div className="toolbar-group">
        <button className="tool-btn icon-only tip" data-tip="Activity" onClick={onToggleActivity} aria-label="Activity history">
          <UsersThree size={iconSize} weight="regular" />
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
          <button
            className={`collaborator-chip tip${vertical ? ' avatar-only' : ''}`}
            data-tip={vertical ? `${collaboratorName || 'Anonymous'} · change name` : 'Change your name'}
            onClick={() => setEditingName(true)}
          >
            <span className="avatar">{(collaboratorName || 'A').trim().charAt(0).toUpperCase()}</span>
            {!vertical && (collaboratorName || 'Anonymous')}
          </button>
        )}
      </div>

      <button
        type="button"
        className="toolbar-hide tip"
        data-tip={collapsed ? 'Keep open' : 'Hide'}
        aria-label={collapsed ? 'Keep toolbar open' : 'Hide toolbar'}
        onClick={collapsed ? show : hide}
      >
        {collapsed ? <ShowIcon size={12} weight="bold" /> : <HideIcon size={12} weight="bold" />}
      </button>
      </div>
    </div>
    </>
  );
}
