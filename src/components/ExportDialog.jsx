import { useState } from 'react';
import { renderBoardToCanvas, exportRaster, exportPdf, downloadBlob } from '../utils/exportBoard';
import { boardToMarkdown } from '../utils/exportMarkdown';
import { sanitizeFileName } from '../db/storage';
import { X, DownloadSimple } from './icons.jsx';
import './ExportDialog.css';

export default function ExportDialog({ board, canvasRef, worldRef, onClose }) {
  const [format, setFormat] = useState('png');
  const [resolution, setResolution] = useState(2);
  const [quality, setQuality] = useState(0.92);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includePrivateNotes, setIncludePrivateNotes] = useState(false);
  const [pdfMode, setPdfMode] = useState('fit');
  const [status, setStatus] = useState(null);

  const run = async () => {
    const base = sanitizeFileName(board.name);
    // Markdown is a plain content dump for pasting into an AI chat, so it skips rendering.
    if (format === 'md') {
      const md = boardToMarkdown(board, { includePrivateNotes });
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
      setStatus('Done!');
      setTimeout(onClose, 500);
      return;
    }
    setStatus('Rendering board…');
    try {
      const canvas = await renderBoardToCanvas({
        worldNode: worldRef.current,
        viewportNode: canvasRef.current,
        board,
        pixelRatio: resolution,
        includeBackground,
        includePrivateNotes,
      });
      if (format === 'pdf') {
        exportPdf(canvas, { mode: pdfMode, filenameBase: base });
      } else {
        await exportRaster(canvas, format, quality, base);
      }
      setStatus('Done!');
      setTimeout(onClose, 500);
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Export failed. Try a lower resolution or fewer items.');
    }
  };

  const FORMATS = [
    { id: 'png', label: 'PNG', hint: 'Sharp, transparent' },
    { id: 'jpg', label: 'JPG', hint: 'Small file' },
    { id: 'pdf', label: 'PDF', hint: 'Print or share' },
    { id: 'md', label: 'Markdown', hint: 'Text for AI' },
  ];
  const isText = format === 'md';

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="dialog-eyebrow">Export</span>
            <h3>{board.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={14} weight="bold" /></button>
        </div>

        <div className="export-field">
          <span className="export-label">Format</span>
          <div className="segmented" role="radiogroup" aria-label="Format">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={format === f.id}
                className={format === f.id ? 'active' : ''}
                onClick={() => setFormat(f.id)}
              >
                <span>{f.label}</span>
                <small>{f.hint}</small>
              </button>
            ))}
          </div>
        </div>

        {isText ? (
          <p className="export-hint">
            A small plain-text file: headings, notes, links, colours, tasks and comments. No layout, no images. Ideal to paste into an AI chat.
          </p>
        ) : (
          <>
            <div className="export-field">
              <span className="export-label">Resolution</span>
              <div className="segmented compact" role="radiogroup" aria-label="Resolution">
                {[1, 2, 3].map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={resolution === r}
                    className={resolution === r ? 'active' : ''}
                    onClick={() => setResolution(r)}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>

            {format === 'jpg' && (
              <div className="export-field">
                <span className="export-label">Quality <em>{Math.round(quality * 100)}%</em></span>
                <input type="range" min="0.4" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </div>
            )}

            {format === 'pdf' && (
              <div className="export-field">
                <span className="export-label">Layout</span>
                <div className="segmented compact" role="radiogroup" aria-label="Layout">
                  <button type="button" role="radio" aria-checked={pdfMode === 'fit'} className={pdfMode === 'fit' ? 'active' : ''} onClick={() => setPdfMode('fit')}>One page</button>
                  <button type="button" role="radio" aria-checked={pdfMode === 'tile'} className={pdfMode === 'tile' ? 'active' : ''} onClick={() => setPdfMode('tile')}>Tiled</button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="export-toggles">
          {!isText && (
            <label className="toggle-row">
              <span>Include background</span>
              <input type="checkbox" checked={includeBackground} onChange={(e) => setIncludeBackground(e.target.checked)} />
              <span className="toggle" />
            </label>
          )}
          <label className="toggle-row">
            <span>Include private notes</span>
            <input type="checkbox" checked={includePrivateNotes} onChange={(e) => setIncludePrivateNotes(e.target.checked)} />
            <span className="toggle" />
          </label>
        </div>

        <button className="primary-btn export-run" onClick={run}>
          {isText ? 'Download .md' : `Export ${format.toUpperCase()}`}
          <span className="btn-orb"><DownloadSimple size={13} weight="bold" /></span>
        </button>
        {status && <p className="export-status">{status}</p>}
      </div>
    </div>
  );
}
