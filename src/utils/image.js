const MAX_DIM = 1200;
const JPEG_QUALITY = 0.72;

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
