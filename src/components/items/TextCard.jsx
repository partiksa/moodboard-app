import { useRef, useState } from 'react';
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
      className="text-card"
      style={{ background: item.backgroundColor, textAlign: item.textAlign, ...wrapperVars }}
      onMouseDown={(e) => {
        if (e.target.isContentEditable) e.stopPropagation();
      }}
    >
      {toolbarOpen && (
        <div className="text-toolbar" onMouseDown={(e) => e.preventDefault()}>
          <div className="text-toolbar-group">
            {BLOCK_STYLES.map((b) => (
              <button key={b.tag} onClick={() => setBlockStyle(b.tag)} title={b.label}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="text-toolbar-divider" />
          <button onClick={() => exec('bold')} title="Bold"><TextB size={13} weight="bold" /></button>
          <button onClick={() => exec('italic')} title="Italic"><TextItalic size={13} weight="bold" /></button>
          <button onClick={() => exec('insertUnorderedList')} title="Bulleted list"><ListBullets size={13} weight="bold" /></button>
          <button onClick={() => exec('insertOrderedList')} title="Numbered list"><ListNumbers size={13} weight="bold" /></button>
          <button onClick={insertLink} title="Insert link"><LinkSimple size={13} weight="bold" /></button>
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
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type anything…"
        onFocus={() => setToolbarOpen(true)}
        onBlur={() => {
          setToolbarOpen(false);
          update({ body: bodyRef.current.innerHTML });
        }}
        dangerouslySetInnerHTML={{ __html: item.body }}
      />
    </div>
  );
}
