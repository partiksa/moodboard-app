import { useState } from 'react';
import { renderBoardToCanvas, exportRaster, exportPdf } from '../utils/exportBoard';
import { sanitizeFileName } from '../db/storage';
import { X } from './icons.jsx';
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
      const base = sanitizeFileName(board.name);
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

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Export board</h3>
          <button onClick={onClose}><X size={14} weight="bold" /></button>
        </div>

        <label>
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="pdf">PDF</option>
          </select>
        </label>

        <label>
          Resolution
          <select value={resolution} onChange={(e) => setResolution(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </label>

        {format === 'jpg' && (
          <label>
            Quality
            <input type="range" min="0.4" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            <span>{Math.round(quality * 100)}%</span>
          </label>
        )}

        {format === 'pdf' && (
          <label>
            Layout
            <select value={pdfMode} onChange={(e) => setPdfMode(e.target.value)}>
              <option value="fit">Fit board to one page</option>
              <option value="tile">Tile across multiple pages</option>
            </select>
          </label>
        )}

        <label>
          <input type="checkbox" checked={includeBackground} onChange={(e) => setIncludeBackground(e.target.checked)} />
          Include background
        </label>

        <label>
          <input type="checkbox" checked={includePrivateNotes} onChange={(e) => setIncludePrivateNotes(e.target.checked)} />
          Include private notes
        </label>

        <button className="primary-btn" onClick={run}>Export</button>
        {status && <p className="export-status">{status}</p>}
      </div>
    </div>
  );
}
