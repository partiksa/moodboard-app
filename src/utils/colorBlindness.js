import { hexToRgb } from './color';

// Colour-vision deficiency simulation, the same RGB matrices Coblis
// (color-blindness.com) uses. Each row maps the output channel from the input R, G, B.
export const CVD_TYPES = [
  { id: 'normal', label: 'Normal vision', group: 'Original', matrix: null },
  { id: 'protanopia', label: 'Protanopia', group: 'Red-blind', matrix: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758] },
  { id: 'protanomaly', label: 'Protanomaly', group: 'Red-weak', matrix: [0.817, 0.183, 0, 0.333, 0.667, 0, 0, 0.125, 0.875] },
  { id: 'deuteranopia', label: 'Deuteranopia', group: 'Green-blind', matrix: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7] },
  { id: 'deuteranomaly', label: 'Deuteranomaly', group: 'Green-weak', matrix: [0.8, 0.2, 0, 0.258, 0.742, 0, 0, 0.142, 0.858] },
  { id: 'tritanopia', label: 'Tritanopia', group: 'Blue-blind', matrix: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525] },
  { id: 'tritanomaly', label: 'Tritanomaly', group: 'Blue-weak', matrix: [0.967, 0.033, 0, 0, 0.733, 0.267, 0, 0.183, 0.817] },
  { id: 'achromatopsia', label: 'Achromatopsia', group: 'Monochromacy', matrix: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114] },
  { id: 'achromatomaly', label: 'Achromatomaly', group: 'Blue cone monochromacy', matrix: [0.618, 0.32, 0.062, 0.163, 0.775, 0.062, 0.163, 0.32, 0.516] },
];

function applyMatrix(m, r, g, b) {
  return [
    Math.min(255, Math.round(m[0] * r + m[1] * g + m[2] * b)),
    Math.min(255, Math.round(m[3] * r + m[4] * g + m[5] * b)),
    Math.min(255, Math.round(m[6] * r + m[7] * g + m[8] * b)),
  ];
}

export function simulateHex(hex, typeId) {
  const type = CVD_TYPES.find((t) => t.id === typeId);
  if (!type?.matrix) return hex;
  const { r, g, b } = hexToRgb(hex);
  const [nr, ng, nb] = applyMatrix(type.matrix, r, g, b);
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be loaded.'));
    img.src = src;
  });
}

// Returns a data URL of the image as seen with the given deficiency. Large images are
// downscaled for the preview so the per-pixel pass stays fast.
export async function simulateImage(src, typeId, maxDim = 1400) {
  const type = CVD_TYPES.find((t) => t.id === typeId);
  const img = await loadImage(src);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  if (type?.matrix) {
    const m = type.matrix;
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      px[i] = Math.min(255, m[0] * r + m[1] * g + m[2] * b);
      px[i + 1] = Math.min(255, m[3] * r + m[4] * g + m[5] * b);
      px[i + 2] = Math.min(255, m[6] * r + m[7] * g + m[8] * b);
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas.toDataURL('image/png');
}

// WCAG 2.x relative luminance and contrast ratio.
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastGrades(ratio) {
  return {
    normalAA: ratio >= 4.5,
    normalAAA: ratio >= 7,
    largeAA: ratio >= 3,
    largeAAA: ratio >= 4.5,
    ui: ratio >= 3,
  };
}
