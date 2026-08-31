import { idbGetMeta, idbSetMeta } from '../db/indexedDb';

const KEY = 'customFonts'; // [{ name, dataUrl, format }]
const loadedNames = new Set();

export async function loadStoredCustomFonts() {
  const fonts = (await idbGetMeta(KEY)) || [];
  for (const font of fonts) {
    await registerFontFace(font);
  }
  return fonts;
}

export async function addCustomFont(file) {
  const dataUrl = await fileToDataUrl(file);
  const name = file.name.replace(/\.[^.]+$/, '');
  const format = guessFormat(file.name);
  const font = { name, dataUrl, format };
  await registerFontFace(font);
  const existing = (await idbGetMeta(KEY)) || [];
  const next = [...existing.filter((f) => f.name !== name), font];
  await idbSetMeta(KEY, next);
  return font;
}

export async function removeCustomFont(name) {
  const existing = (await idbGetMeta(KEY)) || [];
  await idbSetMeta(KEY, existing.filter((f) => f.name !== name));
  loadedNames.delete(name);
}

async function registerFontFace(font) {
  if (loadedNames.has(font.name)) return;
  try {
    const fontFace = new FontFace(font.name, `url(${font.dataUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);
    loadedNames.add(font.name);
  } catch (err) {
    console.error('Font failed to load', font.name, err);
    throw new Error(`Could not load font "${font.name}". The file may be corrupt or unsupported.`);
  }
}

function guessFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[ext] || 'truetype';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const SUPPORTED_FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];
