import { useState } from 'react';
import { formatSwatchValues } from '../../utils/color';

export default function ColorSwatchCard({ item, dispatch }) {
  const [copied, setCopied] = useState(null);
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
  const values = formatSwatchValues(item.hex);

  const copy = (label, value) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 1000);
  };

  return (
    <div className="color-swatch-card">
      <div
        className="color-swatch-fill"
        style={{ background: item.hex }}
        onClick={() => document.getElementById(`color-input-${item.id}`)?.click()}
      >
        <input
          id={`color-input-${item.id}`}
          type="color"
          value={item.hex}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
          onChange={(e) => update({ hex: e.target.value })}
        />
      </div>
      <div className="color-swatch-values">
        {[
          ['HEX', values.hex],
          ['RGB', values.rgb],
          ['CMYK', values.cmyk],
        ].map(([label, value]) => (
          <button key={label} className="color-value-row" onClick={() => copy(label, value)}>
            <span>{label}</span>
            <span>{copied === label ? 'Copied!' : value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
