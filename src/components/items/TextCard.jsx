import { useEffect, useRef, useState } from 'react';
import { isHeadingCard, headingColorForBackground } from '../../utils/textCard';
import { TextB, TextItalic, ListBullets, ListNumbers, LinkSimple } from '../icons.jsx';

const BLOCK_STYLES = [
  { tag: 'h1', label: 'Heading' },
  { tag: 'h2', label: 'Subheading' },
  { tag: 'p', label: 'Text' },
];

export default function TextCard({ item, board, dispatch }) {
  const typography = board.settings.typography;
  const bodyRef = useRef(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  // The card is only editable after a double-click; otherwise a mousedown anywhere on it
  // starts a drag, so text blocks move like every other item. A brand-new empty card opens
  // for editing straight away so typing can start without the extra click.
  const [editing, setEditing] = useState(() => !item.body);
  const heading = isHeadingCard(item.body);
  const headingColor = heading ? headingColorForBackground(board.settings.background) : null;

  // Double-clicks are detected by hand from two quick mousedowns: the browser's dblclick
  // event is unreliable here because the first mousedown starts a drag on the canvas and
  // the item re-renders in between, which some browsers treat as a broken double-click.
  const lastDownRef = useRef({ time: 0, x: 0, y: 0 });
  const focusPointRef = useRef(null);

  const mountedRef = useRef(false);
  useEffect(() => {
    // no focus on mount: a loaded board may hold several empty cards and none should steal focus
    const mounted = mountedRef.current;
    mountedRef.current = true;
    if (!editing || !mounted) return;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const point = focusPointRef.current;
    focusPointRef.current = null;
    if (!point) return;
    // put the caret where the user double-clicked instead of at the start of the text
    const range =
      document.caretRangeFromPoint?.(point.x, point.y) ||
      (document.caretPositionFromPoint
        ? (() => {
            const pos = document.caretPositionFromPoint(point.x, point.y);
            if (!pos) return null;
            const r = document.createRange();
            r.setStart(pos.offsetNode, pos.offset);
            r.collapse(true);
            return r;
          })()
        : null);
    if (range && el.contains(range.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [editing]);

  const startEditing = (e) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    focusPointRef.current = { x: e.clientX, y: e.clientY };
    setEditing(true);
  };

  const onCardMouseDown = (e) => {
    // while editing, clicks inside the card (text or toolbar) must not start a drag
    if (editing) {
      e.stopPropagation();
      return;
    }
    if (e.button !== 0) return;
    const now = Date.now();
    const last = lastDownRef.current;
    const quick = now - last.time < 450 && Math.abs(e.clientX - last.x) < 6 && Math.abs(e.clientY - last.y) < 6;
    lastDownRef.current = { time: now, x: e.clientX, y: e.clientY };
    if (quick) {
      lastDownRef.current.time = 0;
      startEditing(e);
    }
  };

  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });

  const exec = (cmd, value) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    update({ body: bodyRef.current.innerHTML });
  };

  const setBlockStyle = (tag) => exec('formatBlock', `<${tag}>`);

  const insertLink = () => {
    const url = prompt('Link URL:');
    if (url) exec('createLink', url);
  };

  const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[^\s<]+)/gi;

  const linkifyHtml = (text) =>
    text
      .split('\n')
      .map((line) =>
        line.replace(URL_RE, (match) => {
          const href = /^https?:\/\//i.test(match) ? match : `https://${match}`;
          return `<a href="${href}" target="_blank" rel="noreferrer">${match}</a>`;
        })
      )
      .join('<br>');

  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !URL_RE.test(text)) return;
    URL_RE.lastIndex = 0;
    e.preventDefault();
    document.execCommand('insertHTML', false, linkifyHtml(text));
    update({ body: bodyRef.current.innerHTML });
  };

  const openLinkIfClicked = (e) => {
    const link = e.target.closest('a');
    if (link && bodyRef.current?.contains(link)) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    }
  };

  const wrapperVars = {
    '--tc-heading-font': typography.heading.fontFamily,
    '--tc-heading-size': `${typography.heading.fontSize}px`,
    '--tc-heading-color': item.textColor || typography.heading.color,
    '--tc-subheading-font': typography.subheading.fontFamily,
    '--tc-subheading-size': `${typography.subheading.fontSize}px`,
    '--tc-subheading-color': item.textColor || typography.subheading.color,
    '--tc-body-font': typography.body.fontFamily,
    '--tc-body-size': `${typography.body.fontSize}px`,
    '--tc-body-color': item.textColor || typography.body.color,
  };

  return (
    <div
      className={`text-card${heading ? ' text-card--heading' : ''}${editing ? ' editing' : ''}`}
      style={{
        background: heading ? 'transparent' : item.backgroundColor,
        textAlign: item.textAlign,
        ...wrapperVars,
        ...(heading ? { '--tc-heading-color': headingColor || 'var(--text)' } : {}),
      }}
      onMouseDown={onCardMouseDown}
      onDoubleClick={startEditing}
    >
      {toolbarOpen && (
        <div className="text-toolbar" onMouseDown={(e) => e.preventDefault()}>
          <div className="text-toolbar-group">
            {BLOCK_STYLES.map((b) => (
              <button key={b.tag} onClick={() => setBlockStyle(b.tag)}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="text-toolbar-divider" />
          <button className="tip tip-top" data-tip="Bold" data-kbd="⌘ B" onClick={() => exec('bold')} aria-label="Bold"><TextB size={13} weight="bold" /></button>
          <button className="tip tip-top" data-tip="Italic" data-kbd="⌘ I" onClick={() => exec('italic')} aria-label="Italic"><TextItalic size={13} weight="bold" /></button>
          <button className="tip tip-top" data-tip="Bulleted list" onClick={() => exec('insertUnorderedList')} aria-label="Bulleted list"><ListBullets size={13} weight="bold" /></button>
          <button className="tip tip-top" data-tip="Numbered list" onClick={() => exec('insertOrderedList')} aria-label="Numbered list"><ListNumbers size={13} weight="bold" /></button>
          <button className="tip tip-top" data-tip="Insert link" onClick={insertLink} aria-label="Insert link"><LinkSimple size={13} weight="bold" /></button>
          <input
            type="color"
            title="Text color"
            value={item.textColor || '#111111'}
            onChange={(e) => update({ textColor: e.target.value })}
          />
          <input
            type="color"
            title="Background color"
            value={item.backgroundColor || '#ffffff'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
          />
          <select value={item.textAlign} onChange={(e) => update({ textAlign: e.target.value })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      <div
        ref={bodyRef}
        className="text-card-body"
        contentEditable={editing}
        suppressContentEditableWarning
        data-placeholder={editing ? 'Type anything…' : 'Double-click to write'}
        onFocus={() => setToolbarOpen(true)}
        onBlur={() => {
          setToolbarOpen(false);
          setEditing(false);
          update({ body: bodyRef.current.innerHTML });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') bodyRef.current?.blur();
        }}
        onPaste={onPaste}
        onDoubleClick={openLinkIfClicked}
        dangerouslySetInnerHTML={{ __html: item.body }}
      />
    </div>
  );
}
