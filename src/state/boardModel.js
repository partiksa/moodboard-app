import { uid } from '../utils/id';

export const DEFAULT_TYPOGRAPHY = {
  heading: { fontFamily: 'Inter', fontSize: 28, color: '#111111' },
  subheading: { fontFamily: 'Inter', fontSize: 18, color: '#333333' },
  body: { fontFamily: 'Inter', fontSize: 14, color: '#222222' },
  privateNote: { fontFamily: 'Inter', fontSize: 13, color: '#8a6d00' },
};

export const DEFAULT_GRID = { columns: 4, gutter: 16, rowHeight: 150 };

export function createEmptyBoard(name = 'Untitled board') {
  const now = new Date().toISOString();
  return {
    id: uid('board'),
    name,
    createdAt: now,
    updatedAt: now,
    items: [],
    activity: [],
    settings: {
      background: { type: 'dotted-white' },
      gridSize: 24,
      gridColor: '#c9c9c9',
      grid: { ...DEFAULT_GRID },
      typography: DEFAULT_TYPOGRAPHY,
    },
  };
}

export function createItemBase(type, overrides = {}) {
  return {
    id: uid('item'),
    type,
    colSpan: 1,
    rowSpan: 1,
    locked: false,
    privateNote: '',
    ...overrides,
  };
}

export const ITEM_DEFAULTS = {
  text: () => ({
    body: '',
    textAlign: 'left',
    textColor: '#111111',
    backgroundColor: '#ffffff',
  }),
  image: () => ({ src: '', alt: '', naturalWidth: 0, naturalHeight: 0, rowSpan: 2 }),
  video: () => ({ src: '', name: '', rowSpan: 2 }),
  attachment: () => ({ name: '', size: 0, fileType: '', dataUrl: '' }),
  url: () => ({ url: '', title: '', description: '', image: '', fetchedAt: null, failed: false, rowSpan: 2 }),
  color: () => ({ hex: '#4f8cff' }),
  todo: () => ({ tasks: [], rowSpan: 2 }),
  column: () => ({ label: 'Section', colSpan: 2 }),
};

export function makeItem(type, overrides = {}) {
  const factory = ITEM_DEFAULTS[type];
  return createItemBase(type, { ...(factory ? factory() : {}), ...overrides });
}
