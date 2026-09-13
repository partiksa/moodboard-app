import { useState } from 'react';
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
} from '../icons.jsx';
import { filePreviewUrl, fileExtension, fileKind, formatBytes, isPreviewable, downloadFile } from '../../lib/boardFiles';

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

// One tile in the library: preview or type glyph, name, size, and a download orb.
// `onDelete` / `categoryPicker` only exist on the admin side.
export default function FileCard({ file, onDelete, categoryPicker, busy }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | error
  const [previewFailed, setPreviewFailed] = useState(false);
  const Icon = KIND_ICON[fileKind(file.name)] || File;
  const ext = fileExtension(file.name).toUpperCase();
  const preview = isPreviewable(file.name) && !previewFailed;

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

  const tip = state === 'downloading' ? 'Downloading…' : state === 'done' ? 'Saved' : state === 'error' ? 'Download failed' : 'Download';

  return (
    <div className={`file-card kind-${fileKind(file.name)}${busy ? ' busy' : ''}`}>
      <div className="file-card-shell">
        <button type="button" className="file-card-preview" onClick={download} aria-label={`Download ${file.name}`}>
          {preview ? (
            <img src={filePreviewUrl(file.path)} alt="" loading="lazy" onError={() => setPreviewFailed(true)} />
          ) : (
            <span className="file-card-glyph"><Icon size={30} weight="light" /></span>
          )}
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
