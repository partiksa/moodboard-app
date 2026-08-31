import { useEffect, useRef, useState } from 'react';
import { addCustomFont, removeCustomFont, SUPPORTED_FONT_EXTENSIONS } from '../state/fontManager';
import { idbGetMeta } from '../db/indexedDb';
import { DEFAULT_GRID } from '../state/boardModel';
import { X, UploadSimple } from './icons.jsx';
import './SettingsPanel.css';

const BUILTIN_FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New'];
const TYPOGRAPHY_KEYS = [
  ['heading', 'Heading'],
  ['subheading', 'Subheading'],
  ['body', 'Body'],
  ['privateNote', 'Private note'],
];

export default function SettingsPanel({ board, dispatch, onClose }) {
  const [customFonts, setCustomFonts] = useState([]);
  const [fontError, setFontError] = useState(null);
  const fileInputRef = useRef(null);
  const settings = board.settings;
  const grid = settings.grid || DEFAULT_GRID;

  useEffect(() => {
    idbGetMeta('customFonts').then((f) => setCustomFonts(f || []));
  }, []);

  const allFonts = [...BUILTIN_FONTS, ...customFonts.map((f) => f.name)];

  const updateSettings = (patch) => dispatch({ type: 'SET_SETTINGS', patch });
  const updateGrid = (patch) => updateSettings({ grid: { ...grid, ...patch } });
  const updateTypography = (key, patch) =>
    dispatch({ type: 'SET_TYPOGRAPHY', key, patch: { ...settings.typography[key], ...patch } });

  const handleFontUpload = async (file) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_FONT_EXTENSIONS.includes(ext)) {
      setFontError('Unsupported font file. Use .ttf, .otf, .woff, or .woff2.');
      return;
    }
    try {
      setFontError(null);
      const font = await addCustomFont(file);
      setCustomFonts((prev) => [...prev.filter((f) => f.name !== font.name), font]);
    } catch (err) {
      setFontError(err.message);
    }
  };

  const handleBackgroundImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSettings({ background: { type: 'image', imageDataUrl: reader.result } });
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Board settings</h3>
          <button onClick={onClose}><X size={14} weight="bold" /></button>
        </div>

        <section>
          <h4>Background</h4>
          <div className="bg-options">
            {['dotted-white', 'dotted-black'].map((type) => (
              <button
                key={type}
                className={settings.background.type === type ? 'active' : ''}
                onClick={() => updateSettings({ background: { type } })}
              >
                {type.replace('dotted-', 'Dotted ')}
              </button>
            ))}
            <label className="color-swatch-btn">
              Color
              <input
                type="color"
                onChange={(e) => updateSettings({ background: { type: 'color', color: e.target.value } })}
              />
            </label>
            <button onClick={() => document.getElementById('bg-image-input').click()}>Image…</button>
            <input
              id="bg-image-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleBackgroundImage(e.target.files?.[0])}
            />
          </div>
        </section>

        <section>
          <h4>Bento grid</h4>
          <label>
            Columns
            <input
              type="range"
              min="2"
              max="8"
              value={grid.columns}
              onChange={(e) => updateGrid({ columns: Number(e.target.value) })}
            />
            <span>{grid.columns}</span>
          </label>
          <label>
            Row height (px)
            <input
              type="range"
              min="80"
              max="300"
              step="10"
              value={grid.rowHeight}
              onChange={(e) => updateGrid({ rowHeight: Number(e.target.value) })}
            />
            <span>{grid.rowHeight}px</span>
          </label>
          <label>
            Gutter (px)
            <input
              type="range"
              min="0"
              max="48"
              value={grid.gutter}
              onChange={(e) => updateGrid({ gutter: Number(e.target.value) })}
            />
            <span>{grid.gutter}px</span>
          </label>
        </section>

        <section>
          <h4>Background dot pattern</h4>
          <label>
            Dot color
            <input
              type="color"
              value={settings.gridColor}
              onChange={(e) => updateSettings({ gridColor: e.target.value })}
            />
          </label>
          <label>
            Dot spacing (px)
            <input
              type="range"
              min="10"
              max="80"
              value={settings.gridSize}
              onChange={(e) => updateSettings({ gridSize: Number(e.target.value) })}
            />
            <span>{settings.gridSize}px</span>
          </label>
        </section>

        <section>
          <h4>Typography</h4>
          {TYPOGRAPHY_KEYS.map(([key, label]) => (
            <div className="typography-row" key={key}>
              <span className="typography-label">{label}</span>
              <select
                value={settings.typography[key].fontFamily}
                onChange={(e) => updateTypography(key, { fontFamily: e.target.value })}
              >
                {allFonts.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input
                type="number"
                min="8"
                max="96"
                value={settings.typography[key].fontSize}
                onChange={(e) => updateTypography(key, { fontSize: Number(e.target.value) })}
              />
              <input
                type="color"
                value={settings.typography[key].color}
                onChange={(e) => updateTypography(key, { color: e.target.value })}
              />
            </div>
          ))}
        </section>

        <section>
          <h4>Custom fonts</h4>
          <button onClick={() => fileInputRef.current?.click()}>
            <UploadSimple size={14} weight="bold" /> Upload font file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            style={{ display: 'none' }}
            onChange={(e) => handleFontUpload(e.target.files?.[0])}
          />
          {fontError && <p className="error-text">{fontError}</p>}
          <ul className="font-list">
            {customFonts.map((f) => (
              <li key={f.name} style={{ fontFamily: f.name }}>
                {f.name}
                <button onClick={() => { removeCustomFont(f.name); setCustomFonts((prev) => prev.filter((x) => x.name !== f.name)); }}>
                  <X size={12} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
