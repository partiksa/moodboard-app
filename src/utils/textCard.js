import { hexToRgb } from './color';

// A text card whose first block is an <h1> is treated as a standalone heading: the card's
// box, padding and background disappear and only the large text is drawn on the board.
export function isHeadingCard(body) {
  return /^\s*(<[^>]*>\s*)*?<h1[\s>]/i.test(body || '');
}

// White or black for heading text so it reads on the current board background. Returns null
// when the theme decides (dotted white canvas follows light/dark mode).
export function headingColorForBackground(bg) {
  if (!bg) return null;
  if (bg.type === 'dotted-black' || bg.type === 'image') return '#ffffff';
  if (bg.type === 'color' && bg.color) {
    const { r, g, b } = hexToRgb(bg.color);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#111111' : '#ffffff';
  }
  return null;
}
