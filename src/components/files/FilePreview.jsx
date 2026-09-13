import { useEffect, useState } from 'react';
import { X, DownloadSimple } from '../icons.jsx';
import { downloadFile, formatBytes } from '../../lib/boardFiles';

// Large preview over the library: image, playable video, or an embedded PDF.
export default function FilePreview({ file, kind, url, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try { await downloadFile(file); } finally { setDownloading(false); }
  };

  return (
    <div className="file-preview-overlay" onClick={onClose} role="dialog" aria-label={`Preview of ${file.name}`}>
      <div className="file-preview-top" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-title">
          <strong>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
        </div>
        <div className="file-preview-tools">
          <button type="button" className="file-preview-btn" onClick={download} disabled={downloading}>
            {downloading ? 'Saving…' : 'Download'}
            <span className="btn-orb"><DownloadSimple size={12} weight="bold" /></span>
          </button>
          <button type="button" className="file-preview-close" onClick={onClose} aria-label="Close preview">
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className={`file-preview-stage kind-${kind}`} onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && <img src={url} alt={file.name} />}
        {kind === 'video' && <video src={url} controls autoPlay playsInline />}
        {kind === 'pdf' && <iframe src={`${url}#view=FitH`} title={file.name} />}
      </div>
    </div>
  );
}
