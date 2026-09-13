import { useRef, useState } from 'react';
import {
  Image,
  VideoCamera,
  File,
  Cube,
  FileZip,
  FilePdf,
  FileText,
  FileSvg,
  MusicNote,
  PaintBrush,
  TextT,
  DownloadSimple,
  TrashSimple,
  Check,
  Eye,
} from '../icons.jsx';
import { filePreviewUrl, fileExtension, fileKind, formatBytes, previewType, downloadFile } from '../../lib/boardFiles';

const KIND_ICON = {
  image: Image,
  vector: FileSvg,
  pdf: FilePdf,
  video: VideoCamera,
  audio: MusicNote,
  model: Cube,
  archive: FileZip,
  design: PaintBrush,
  text: FileText,
  font: TextT,
  other: File,
};

// One tile in the library: inline preview (image, video, PDF) or a type glyph, name, size,
// and a download orb. Clicking a preview opens it large; `onDelete` / `categoryPicker`
// only exist on the admin side.
export default function FileCard({ file, onPreview, onDelete, categoryPicker, busy }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | error
  const [previewFailed, setPreviewFailed] = useState(false);
  const videoRef = useRef(null);
  const Icon = KIND_ICON[fileKind(file.name)] || File;
  const ext = fileExtension(file.name).toUpperCase();
  const kind = previewFailed ? null : previewType(file);
  const url = kind ? filePreviewUrl(file.path) : null;

  const download = async () => {
    if (state === 'downloading') return;
    setState('downloading');
    try {
      await downloadFile(file);
      setState('done');
    } catch {
      setState('error');
    } finally {
      setTimeout(() => setState('idle'), 1600);
    }
  };

  const openPreview = () => {
    if (kind && onPreview) onPreview(file, kind, url);
    else download();
  };

  // hovering a video tile plays it muted from the start, leaving it stops and rewinds
  const playPeek = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };
  const stopPeek = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  const tip = state === 'downloading' ? 'Downloading…' : state === 'done' ? 'Saved' : state === 'error' ? 'Download failed' : 'Download';

  return (
    <div className={`file-card kind-${fileKind(file.name)}${busy ? ' busy' : ''}`}>
      <div className="file-card-shell">
        <button
          type="button"
          className={`file-card-preview${kind ? ' has-preview' : ''}`}
          onClick={openPreview}
          onMouseEnter={kind === 'video' ? playPeek : undefined}
          onMouseLeave={kind === 'video' ? stopPeek : undefined}
          aria-label={kind ? `Preview ${file.name}` : `Download ${file.name}`}
        >
          {kind === 'image' && (
            <img src={url} alt="" loading="lazy" onError={() => setPreviewFailed(true)} />
          )}
          {kind === 'video' && (
            <video
              ref={videoRef}
              src={`${url}#t=0.1`}
              muted
              playsInline
              loop
              preload="metadata"
              onError={() => setPreviewFailed(true)}
            />
          )}
          {kind === 'pdf' && (
            <div className="file-card-pdf">
              <object data={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} type="application/pdf" aria-hidden="true">
                <span className="file-card-glyph"><FilePdf size={30} weight="light" /></span>
              </object>
            </div>
          )}
          {!kind && <span className="file-card-glyph"><Icon size={30} weight="light" /></span>}
          {kind && <span className="file-card-eye"><Eye size={13} weight="bold" /></span>}
          {ext && <span className="file-card-ext">{ext}</span>}
        </button>
      </div>
      <div className="file-card-meta">
        <div className="file-card-name" title={file.name}>{file.name}</div>
        <div className="file-card-sub">{formatBytes(file.size)}</div>
      </div>
      <div className="file-card-actions">
        {categoryPicker}
        <button
          type="button"
          className={`file-card-btn tip tip-top state-${state}`}
          data-tip={tip}
          onClick={download}
          aria-label={`Download ${file.name}`}
        >
          {state === 'done' ? <Check size={13} weight="bold" /> : <DownloadSimple size={14} weight="bold" />}
        </button>
        {onDelete && (
          <button
            type="button"
            className="file-card-btn danger tip tip-top"
            data-tip="Delete file"
            onClick={() => onDelete(file)}
            disabled={busy}
            aria-label={`Delete ${file.name}`}
          >
            <TrashSimple size={14} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
