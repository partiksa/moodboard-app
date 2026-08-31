export function boardReducer(state, action) {
  switch (action.type) {
    case 'SET_BOARD':
      return action.board;

    case 'RENAME_BOARD':
      return { ...state, name: action.name };

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] };

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
      return { ...state, items: state.items.filter((i) => !ids.has(i.id)) };
    }

    case 'DUPLICATE_ITEMS': {
      const afterId = action.afterId;
      const insertAt = afterId ? state.items.findIndex((i) => i.id === afterId) + 1 : state.items.length;
      const items = [...state.items];
      items.splice(insertAt, 0, ...action.items);
      return { ...state, items };
    }

    case 'COMMIT_ITEMS': {
      const patchMap = action.patches;
      return {
        ...state,
        items: state.items.map((i) => (patchMap[i.id] ? { ...i, ...patchMap[i.id] } : i)),
      };
    }

    case 'REORDER_ITEM': {
      const items = [...state.items];
      const fromIndex = items.findIndex((i) => i.id === action.id);
      if (fromIndex === -1) return state;
      const [moved] = items.splice(fromIndex, 1);
      const toIndex = Math.max(0, Math.min(items.length, action.toIndex));
      items.splice(toIndex, 0, moved);
      return { ...state, items };
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
  'SET_SETTINGS',
  'SET_TYPOGRAPHY',
  'COMMIT_ITEMS', // used after span-resize ends
  'REORDER_ITEM',
]);
