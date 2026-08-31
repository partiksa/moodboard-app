import { useState } from 'react';
import { LockSimple } from '../icons.jsx';

export default function PrivateNoteBadge({ note }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="private-note-badge"
      title="Has a private note (excluded from export by default)"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      <LockSimple size={10} weight="bold" />
      {open && <div className="private-note-preview">{note}</div>}
    </div>
  );
}
