export function boardReducer(state, action) {
  switch (action.type) {
    case 'SET_BOARD':
      return action.board;

    case 'RENAME_BOARD':
      return { ...state, name: action.name };

    case 'ADD_ITEM': {
      const maxZ = state.items.reduce((m, i) => Math.max(m, i.zIndex), 0);
      const item = { ...action.item, zIndex: maxZ + 1 };
      return { ...state, items: [...state.items, item] };
    }

    case 'ADD_ITEMS':
      return { ...state, items: [...state.items, ...action.items] };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      };

    case 'UPDATE_ITEMS': {
      const patchMap = action.patches; // { [id]: patch }
      return {
        ...state,
        items: state.items.map((i) => (patchMap[i.id] ? { ...i, ...patchMap[i.id] } : i)),
      };
    }

    case 'DELETE_ITEMS': {
      const ids = new Set(action.ids);
      return { ...state, items: state.items.filter((i) => !ids.has(i.id) && !ids.has(i.parentId)) };
    }

    case 'DUPLICATE_ITEMS':
      return { ...state, items: [...state.items, ...action.items] };

    case 'COMMIT_ITEMS': {
      const patchMap = action.patches;
      return {
        ...state,
        items: state.items.map((i) => (patchMap[i.id] ? { ...i, ...patchMap[i.id] } : i)),
      };
    }

    case 'BRING_TO_FRONT': {
      const maxZ = state.items.reduce((m, i) => Math.max(m, i.zIndex), 0);
      const ids = new Set(action.ids);
      let offset = 1;
      return {
        ...state,
        items: state.items.map((i) => (ids.has(i.id) ? { ...i, zIndex: maxZ + offset++ } : i)),
      };
    }

    case 'SEND_TO_BACK': {
      const minZ = state.items.reduce((m, i) => Math.min(m, i.zIndex), 0);
      const ids = new Set(action.ids);
      let offset = 1;
      return {
        ...state,
        items: state.items.map((i) => (ids.has(i.id) ? { ...i, zIndex: minZ - offset++ } : i)),
      };
    }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'SET_TYPOGRAPHY':
      return {
        ...state,
        settings: {
          ...state.settings,
          typography: { ...state.settings.typography, [action.key]: action.patch },
        },
      };

    default:
      return state;
  }
}

// Actions that should push a history checkpoint (transient actions like drag-in-progress
// are applied directly via UPDATE_ITEMS without history, then a final commit records one).
export const HISTORY_ACTIONS = new Set([
  'RENAME_BOARD',
  'ADD_ITEM',
  'ADD_ITEMS',
  'DELETE_ITEMS',
  'DUPLICATE_ITEMS',
  'BRING_TO_FRONT',
  'SEND_TO_BACK',
  'SET_SETTINGS',
  'SET_TYPOGRAPHY',
  'COMMIT_ITEMS', // used after drag/resize/rotate ends
]);
