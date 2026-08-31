import { uid } from '../utils/id';

export const DEFAULT_TYPOGRAPHY = {
  heading: { fontFamily: 'Inter', fontSize: 28, color: '#111111' },
  subheading: { fontFamily: 'Inter', fontSize: 18, color: '#333333' },
  body: { fontFamily: 'Inter', fontSize: 14, color: '#222222' },
  privateNote: { fontFamily: 'Inter', fontSize: 13, color: '#8a6d00' },
};

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
      snapDistance: 8,
      typography: DEFAULT_TYPOGRAPHY,
    },
  };
}

export function createItemBase(type, overrides = {}) {
  return {
    id: uid('item'),
    type,
    x: 100,
    y: 100,
    width: 240,
    height: 160,
    rotation: 0,
    zIndex: 1,
    locked: false,
    parentId: null,
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
  image: () => ({ src: '', alt: '', naturalWidth: 0, naturalHeight: 0 }),
  video: () => ({ src: '', name: '' }),
  attachment: () => ({ name: '', size: 0, fileType: '', dataUrl: '' }),
  url: () => ({ url: '', title: '', description: '', image: '', fetchedAt: null, failed: false }),
  color: () => ({ hex: '#4f8cff' }),
  // starts with one empty row so the card is immediately typeable (Enter adds the next)
  todo: () => ({ tasks: [{ id: uid('task'), text: '', done: false }] }),
  column: () => ({ label: 'Column', childIds: [] }),
};

export function makeItem(type, overrides = {}) {
  const factory = ITEM_DEFAULTS[type];
  return createItemBase(type, { ...(factory ? factory() : {}), ...overrides });
}
