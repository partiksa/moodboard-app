const MAX_DIM = 1200;
const JPEG_QUALITY = 0.72;
const MAX_DATA_URL_CHARS = 700 * 1024;

// Clipboards often carry the same picture several times over (a vector plus a rasterized
// fallback). Anything that can hold vector data is returned as markup so it never gets
// flattened; only genuinely raster clipboards fall through to a file.
export function readClipboardSvg(clipboardData) {
  if (!clipboardData) return null;
  const isSvg = (s) => /^\s*(<\?xml[^>]*>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s\S]*<\/svg>\s*$/i.test(s || '');
  const plain = clipboardData.getData('text/plain');
  if (isSvg(plain)) return plain.trim();
  const html = clipboardData.getData('text/html');
  if (html) {
    const match = html.match(/<svg[\s\S]*?<\/svg>/i);
    if (match) return match[0];
  }
  return null;
}

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
      const render = (maxDim) => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return { canvas, ctx, width, height };
      };

      let { canvas, ctx, width, height } = render(MAX_DIM);
      // JPEG has no alpha channel, so a transparent image re-encoded as JPEG comes out with a
      // black background. Transparent images therefore stay PNG, shrunk until they fit.
      if (hasTransparency(ctx, width, height)) {
        let out = canvas.toDataURL('image/png');
        let maxDim = MAX_DIM;
        while (out.length > MAX_DATA_URL_CHARS && maxDim > 320) {
          maxDim = Math.round(maxDim * 0.7);
          ({ canvas, width, height } = render(maxDim));
          out = canvas.toDataURL('image/png');
        }
        resolve({ dataUrl: out, width, height });
        return;
      }
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width, height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function hasTransparency(ctx, width, height) {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    return false; // tainted canvas: assume opaque rather than throwing away the image
  }
}
