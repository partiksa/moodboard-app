import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Renders the board's bento-grid node to an offscreen canvas at the given pixel ratio.
export async function renderBoardToCanvas({ gridNode, board, pixelRatio, includeBackground, includePrivateNotes }) {
  if (board.items.length === 0) throw new Error('This board has no items to export.');

  const rect = gridNode.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(gridNode.scrollHeight);
  const prevBg = gridNode.style.background;
  const prevBgImage = gridNode.style.backgroundImage;
  if (!includeBackground) {
    gridNode.style.background = 'transparent';
    gridNode.style.backgroundImage = 'none';
  }

  const filter = (node) => {
    if (!includePrivateNotes && node.classList?.contains('private-note-badge')) return false;
    if (node.classList?.contains('selection-toolbar')) return false;
    return true;
  };

  try {
    // allow layout to settle before capture
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await toCanvas(gridNode, {
      width,
      height,
      pixelRatio,
      filter,
      backgroundColor: includeBackground ? undefined : null,
    });
    return canvas;
  } finally {
    gridNode.style.background = prevBg;
    gridNode.style.backgroundImage = prevBgImage;
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
