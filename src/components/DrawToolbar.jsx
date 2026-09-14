import { PencilSimple, Eraser, Check, HandPointing } from './icons.jsx';
import './DrawToolbar.css';

export const DRAW_COLORS = ['#141414', '#ffffff', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5'];
export const DRAW_SIZES = [
  { id: 'thin', size: 3, label: 'Thin' },
  { id: 'medium', size: 6, label: 'Medium' },
  { id: 'thick', size: 12, label: 'Thick' },
];

// Floating pill at the bottom while the drawing tool is active: pen or eraser, colour,
// stroke weight, pencil-only (palm rejection) and Done.
export default function DrawToolbar({ draw, onChange, onDone }) {
  const set = (patch) => onChange({ ...draw, ...patch });
  return (
    <div className="draw-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="draw-group">
        <button
          type="button"
          className={`draw-btn tip tip-top${draw.tool === 'pen' ? ' active' : ''}`}
          data-tip="Pen"
          onClick={() => set({ tool: 'pen' })}
          aria-label="Pen"
        >
          <PencilSimple size={15} weight="regular" />
        </button>
        <button
          type="button"
          className={`draw-btn tip tip-top${draw.tool === 'eraser' ? ' active' : ''}`}
          data-tip="Eraser"
          data-hint="Removes whole strokes"
          onClick={() => set({ tool: 'eraser' })}
          aria-label="Eraser"
        >
          <Eraser size={15} weight="regular" />
        </button>
      </div>

      <span className="draw-divider" />

      <div className="draw-group draw-colors">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`draw-swatch${draw.color === c ? ' active' : ''}`}
            style={{ '--swatch': c }}
            onClick={() => set({ color: c, tool: 'pen' })}
            aria-label={`Colour ${c}`}
          />
        ))}
        <label className="draw-swatch custom tip tip-top" data-tip="Custom colour" style={{ '--swatch': draw.color }}>
          <input type="color" value={draw.color} onChange={(e) => set({ color: e.target.value, tool: 'pen' })} aria-label="Custom colour" />
        </label>
      </div>

      <span className="draw-divider" />

      <div className="draw-group">
        {DRAW_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`draw-btn draw-size tip tip-top${draw.size === s.size ? ' active' : ''}`}
            data-tip={s.label}
            onClick={() => set({ size: s.size, tool: 'pen' })}
            aria-label={`${s.label} stroke`}
          >
            <span style={{ width: s.size + 2, height: s.size + 2 }} />
          </button>
        ))}
      </div>

      <span className="draw-divider" />

      <button
        type="button"
        className={`draw-btn tip tip-top tip-rich${draw.penOnly ? ' active' : ''}`}
        data-tip="Pencil only"
        data-hint={draw.penOnly ? 'Fingers pan, Apple Pencil draws' : 'Fingers draw too'}
        onClick={() => set({ penOnly: !draw.penOnly })}
        aria-label="Pencil only"
        aria-pressed={draw.penOnly}
      >
        <HandPointing size={15} weight="regular" />
      </button>

      <button type="button" className="draw-done" onClick={onDone}>
        Done
        <span className="btn-orb"><Check size={12} weight="bold" /></span>
      </button>
    </div>
  );
}
