import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Renders the board's world node to an offscreen canvas at the given pixel ratio,
// temporarily reframing the viewport to the content bounds so the whole board is captured.
export async function renderBoardToCanvas({ worldNode, viewportNode, board, pixelRatio, includeBackground, includePrivateNotes }) {
  const items = board.items;
  if (items.length === 0) throw new Error('This board has no items to export.');

  const PADDING = 60;
  const minX = Math.min(...items.map((i) => i.x)) - PADDING;
  const minY = Math.min(...items.map((i) => i.y)) - PADDING;
  const maxX = Math.max(...items.map((i) => i.x + i.width)) + PADDING;
  const maxY = Math.max(...items.map((i) => i.y + i.height)) + PADDING;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);

  const prevTransform = worldNode.style.transform;
  const prevOverflow = viewportNode.style.overflow;
  const prevBg = viewportNode.style.background;

  worldNode.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
  viewportNode.style.overflow = 'visible';
  if (!includeBackground) viewportNode.style.background = 'transparent';

  const filter = (node) => {
    if (!includePrivateNotes && node.classList?.contains('private-note-badge')) return false;
    if (node.classList?.contains('resize-handle') || node.classList?.contains('rotate-handle')) return false;
    if (node.classList?.contains('selection-toolbar')) return false;
    return true;
  };

  try {
    // allow layout to settle before capture
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await toCanvas(viewportNode, {
      width,
      height,
      pixelRatio,
      filter,
      backgroundColor: includeBackground ? undefined : null,
    });
    return canvas;
  } finally {
    worldNode.style.transform = prevTransform;
    viewportNode.style.overflow = prevOverflow;
    viewportNode.style.background = prevBg;
  }
}

export function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRaster(canvas, format, quality, filenameBase) {
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await canvasToBlob(canvas, mime, quality);
  downloadBlob(blob, `${filenameBase}.${format}`);
}

export function exportPdf(canvas, { mode, filenameBase }) {
  const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/png');

  if (mode === 'fit') {
    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h);
  } else {
    const scale = pageWidth / canvas.width;
    const pageHeightInCanvasPx = pageHeight / scale;
    const totalPages = Math.ceil(canvas.height / pageHeightInCanvasPx);
    for (let p = 0; p < totalPages; p++) {
      if (p > 0) pdf.addPage();
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      const sliceHeightPx = Math.min(pageHeightInCanvasPx, canvas.height - p * pageHeightInCanvasPx);
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -p * pageHeightInCanvasPx);
      const sliceData = sliceCanvas.toDataURL('image/png');
      pdf.addImage(sliceData, 'PNG', 0, 0, pageWidth, sliceHeightPx * scale);
    }
  }
  pdf.save(`${filenameBase}.pdf`);
}
