import { useEffect, useMemo, useState } from 'react';
import { CVD_TYPES, simulateImage, simulateHex, contrastRatio, contrastGrades } from '../utils/colorBlindness';
import { normalizeHex } from '../utils/color';
import { X } from './icons.jsx';
import './ColorCheckDialog.css';

// Two checks in one place: how an image reads with each kind of colour blindness, and the
// WCAG contrast between two colours (swatches from the board or any typed value).
export default function ColorCheckDialog({ board, item, onClose }) {
  const isImage = item?.type === 'image' && item.src;
  const [tab, setTab] = useState(isImage ? 'simulate' : 'contrast');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="color-check-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="dialog-eyebrow">Accessibility</span>
            <h3>Color check</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={14} weight="bold" /></button>
        </div>

        <div className="segmented compact color-check-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'simulate'} className={tab === 'simulate' ? 'active' : ''} onClick={() => setTab('simulate')} disabled={!isImage}>
            Color blindness
          </button>
          <button type="button" role="tab" aria-selected={tab === 'contrast'} className={tab === 'contrast' ? 'active' : ''} onClick={() => setTab('contrast')}>
            Contrast
          </button>
        </div>

        {tab === 'simulate' && isImage && <SimulatePane src={item.src} />}
        {tab === 'contrast' && <ContrastPane board={board} item={item} />}
      </div>
    </div>
  );
}

function SimulatePane({ src }) {
  const [type, setType] = useState('normal');
  const [previews, setPreviews] = useState({ normal: src });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (previews[type]) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    simulateImage(src, type)
      .then((url) => {
        if (!cancelled) setPreviews((p) => ({ ...p, [type]: url }));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, src, previews]);

  const current = CVD_TYPES.find((t) => t.id === type);

  return (
    <div className="color-check-body">
      <div className="cvd-preview">
        <img src={previews[type] || src} alt={`${current.label} preview`} className={busy ? 'loading' : ''} />
        {busy && <span className="cvd-status">Rendering…</span>}
        {error && <span className="cvd-status error">{error}</span>}
        <span className="cvd-caption">{current.label}<small>{current.group}</small></span>
      </div>
      <div className="cvd-types" role="radiogroup" aria-label="Type of colour blindness">
        {CVD_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={type === t.id}
            className={type === t.id ? 'active' : ''}
            onClick={() => setType(t.id)}
          >
            <span className="cvd-dots" aria-hidden="true">
              {['#e5484d', '#30a46c', '#0091ff', '#f5d90a'].map((c) => (
                <i key={c} style={{ background: simulateHex(c, t.id) }} />
              ))}
            </span>
            <span>
              {t.label}
              <small>{t.group}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContrastPane({ board, item }) {
  const swatches = useMemo(
    () => (board.items || []).filter((i) => i.type === 'color' && i.hex).map((i) => i.hex.toUpperCase()),
    [board.items]
  );
  const unique = [...new Set(swatches)];
  const [fg, setFg] = useState(item?.type === 'color' ? item.hex : unique[0] || '#111111');
  const [bg, setBg] = useState(unique.find((h) => h !== (item?.hex || '').toUpperCase()) || '#FFFFFF');
  const [cvd, setCvd] = useState('normal');

  const fgHex = normalizeHex(fg) || '#000000';
  const bgHex = normalizeHex(bg) || '#ffffff';
  const fgSim = simulateHex(fgHex, cvd);
  const bgSim = simulateHex(bgHex, cvd);
  const ratio = contrastRatio(fgSim, bgSim);
  const grades = contrastGrades(ratio);

  return (
    <div className="color-check-body">
      <div className="contrast-sample" style={{ background: bgSim, color: fgSim }}>
        <span className="contrast-sample-large">Large heading 24px</span>
        <span className="contrast-sample-normal">Body text at 16px looks like this on the chosen background.</span>
        <span className="contrast-ratio">{ratio.toFixed(2)}<small>:1</small></span>
      </div>

      <div className="contrast-inputs">
        <ColorField label="Text" value={fg} onChange={setFg} swatches={unique} />
        <button type="button" className="contrast-swap tip" data-tip="Swap" aria-label="Swap colours" onClick={() => { setFg(bg); setBg(fg); }}>⇄</button>
        <ColorField label="Background" value={bg} onChange={setBg} swatches={unique} />
      </div>

      <div className="contrast-grades">
        <Grade ok={grades.normalAA} label="AA normal text" need="4.5" />
        <Grade ok={grades.normalAAA} label="AAA normal text" need="7" />
        <Grade ok={grades.largeAA} label="AA large text" need="3" />
        <Grade ok={grades.largeAAA} label="AAA large text" need="4.5" />
        <Grade ok={grades.ui} label="UI components" need="3" />
      </div>

      <label className="contrast-cvd">
        <span>Seen with</span>
        <select value={cvd} onChange={(e) => setCvd(e.target.value)}>
          {CVD_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ColorField({ label, value, onChange, swatches }) {
  const hex = normalizeHex(value) || '#000000';
  return (
    <div className="color-field">
      <span className="export-label">{label}</span>
      <div className="color-field-row">
        <label className="color-field-swatch" style={{ background: hex }}>
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`} />
        </label>
        <input
          className="color-field-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={`${label} hex`}
        />
      </div>
      {swatches.length > 0 && (
        <div className="color-field-swatches">
          {swatches.map((h) => (
            <button key={h} type="button" className="tip" data-tip={h} style={{ background: h }} onClick={() => onChange(h)} aria-label={`Use ${h}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Grade({ ok, label, need }) {
  return (
    <div className={`grade ${ok ? 'pass' : 'fail'}`}>
      <span className="grade-mark">{ok ? 'Pass' : 'Fail'}</span>
      <span className="grade-label">{label}</span>
      <span className="grade-need">≥ {need}:1</span>
    </div>
  );
}
