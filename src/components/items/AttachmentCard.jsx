import { useRef } from 'react';
import { Paperclip, DownloadSimple } from '../icons.jsx';

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function AttachmentCard({ item, dispatch }) {
  const inputRef = useRef(null);
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });

  const loadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      update({ name: file.name, size: file.size, fileType: file.type || 'unknown', dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const openOrDownload = () => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.name;
    a.click();
  };

  if (!item.name) {
    return (
      <div
        className="image-dropzone"
        onDrop={(e) => {
          e.preventDefault();
          loadFile(e.dataTransfer.files?.[0]);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <p>Click or drop any file</p>
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={(e) => loadFile(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div className="attachment-card" onDoubleClick={openOrDownload}>
      <div className="attachment-icon"><Paperclip size={22} weight="bold" /></div>
      <div className="attachment-meta">
        <div className="attachment-name" title={item.name}>{item.name}</div>
        <div className="attachment-sub">{item.fileType || 'file'} · {formatSize(item.size)}</div>
      </div>
      <button className="attachment-open" onClick={openOrDownload}>
        <DownloadSimple size={13} weight="bold" /> Open
      </button>
    </div>
  );
}
