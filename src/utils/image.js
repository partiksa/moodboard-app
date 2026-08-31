const MAX_DIM = 1200;
const JPEG_QUALITY = 0.72;

// Clipboards from vector tools (Figma, Illustrator, browsers) usually offer both a
// rasterized image/png fallback AND the real image/svg+xml — prefer the vector one so
// pasted vectors keep their bezier quality and native transparency instead of being
// flattened to a JPEG with a black background.
export function pickClipboardImageFile(clipboardItems) {
  const list = [...(clipboardItems || [])];
  const svg = list.find((it) => it.type === 'image/svg+xml');
  const any = list.find((it) => it.type.startsWith('image/'));
  const picked = svg || any;
  return picked ? picked.getAsFile() : null;
}

export function svgMarkupToDataUrl(svgText) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export function parseSvgIntrinsicSize(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName !== 'svg' || doc.querySelector('parsererror')) return null;
    const w = parseFloat(svg.getAttribute('width'));
    const h = parseFloat(svg.getAttribute('height'));
    if (w > 0 && h > 0) return { width: w, height: h };
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { width: parts[2], height: parts[3] };
    }
    return null;
  } catch {
    return null;
  }
}

// Downscales and re-encodes an image data URL so it stays small enough to fit in a
// board.json file saved through GitHub's Contents API (hard limit ~1MB per file).
// SVGs are left untouched since they're vector and already small.
export function compressImage(dataUrl, mimeType) {
  if (mimeType === 'image/svg+xml') {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
        width,
        height,
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
