const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Accepts "#fff", "fff", "#ffffff", "ffffff" (case-insensitive); returns null if not a hex color.
export function normalizeHex(text) {
  const clean = (text || '').trim();
  if (!HEX_RE.test(clean)) return null;
  const stripped = clean.replace('#', '');
  const full = stripped.length === 3 ? stripped.split('').map((c) => c + c).join('') : stripped;
  return `#${full.toLowerCase()}`;
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToCmyk({ r, g, b }) {
  const rp = r / 255, gp = g / 255, bp = b / 255;
  const k = 1 - Math.max(rp, gp, bp);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rp - k) / (1 - k);
  const m = (1 - gp - k) / (1 - k);
  const y = (1 - bp - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function formatSwatchValues(hex) {
  const rgb = hexToRgb(hex);
  const cmyk = rgbToCmyk(rgb);
  return {
    hex: hex.toUpperCase(),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    cmyk: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
  };
}
