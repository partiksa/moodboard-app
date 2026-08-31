const ACTIVITY_LIMIT = 300;

const TYPE_LABELS = {
  text: 'text note',
  image: 'image',
  video: 'video',
  attachment: 'file',
  url: 'link card',
  color: 'color swatch',
  todo: 'to-do list',
  column: 'section',
};

function itemTitle(item) {
  if (!item) return '';
  if (item.type === 'text') return stripHtml(item.body).slice(0, 40) || 'untitled note';
  if (item.type === 'image') return item.alt || 'image';
  if (item.type === 'video') return item.name || 'video';
  if (item.type === 'attachment') return item.name || 'file';
  if (item.type === 'url') return item.title || item.url || 'link';
  if (item.type === 'color') return item.hex || 'color';
  if (item.type === 'todo') return 'to-do list';
  if (item.type === 'column') return item.label || 'section';
  return TYPE_LABELS[item.type] || item.type;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Classifies a dispatched board action into a human-readable activity description.
// `board` is the state BEFORE the action is applied (so items still exist for deletes).
export function describeAction(action, board) {
  switch (action.type) {
    case 'ADD_ITEM':
      return { verb: 'added', itemType: TYPE_LABELS[action.item.type] || action.item.type, itemTitle: itemTitle(action.item) };

    case 'ADD_ITEMS':
      if (!action.items.length) return null;
      return action.items.length === 1
        ? { verb: 'added', itemType: TYPE_LABELS[action.items[0].type], itemTitle: itemTitle(action.items[0]) }
        : { verb: 'added', itemType: `${action.items.length} items`, itemTitle: '' };

    case 'DELETE_ITEMS': {
      const items = board.items.filter((i) => action.ids.includes(i.id));
      if (!items.length) return null;
      return items.length === 1
        ? { verb: 'deleted', itemType: TYPE_LABELS[items[0].type] || items[0].type, itemTitle: itemTitle(items[0]) }
        : { verb: 'deleted', itemType: `${items.length} items`, itemTitle: '' };
    }

    case 'DUPLICATE_ITEMS':
      if (!action.items.length) return null;
      return action.items.length === 1
        ? { verb: 'duplicated', itemType: TYPE_LABELS[action.items[0].type], itemTitle: itemTitle(action.items[0]) }
        : { verb: 'duplicated', itemType: `${action.items.length} items`, itemTitle: '' };

    case 'COMMIT_ITEMS': {
      const ids = Object.keys(action.patches);
      if (!ids.length) return null;
      const sample = action.patches[ids[0]];
      let verb = 'edited';
      if ('colSpan' in sample || 'rowSpan' in sample) verb = 'resized';
      const item = board.items.find((i) => i.id === ids[0]);
      return ids.length === 1
        ? { verb, itemType: TYPE_LABELS[item?.type] || item?.type, itemTitle: itemTitle(item) }
        : { verb, itemType: `${ids.length} items`, itemTitle: '' };
    }

    case 'REORDER_ITEM': {
      const item = board.items.find((i) => i.id === action.id);
      if (!item) return null;
      return { verb: 'moved', itemType: TYPE_LABELS[item.type] || item.type, itemTitle: itemTitle(item) };
    }

    case 'UPDATE_ITEM': {
      const item = board.items.find((i) => i.id === action.id);
      if (!item) return null;
      if (action.patch.privateNote !== undefined) {
        return { verb: 'edited', itemType: 'private note', itemTitle: '', private: true };
      }
      if (item.type === 'todo' && action.patch.tasks) {
        return { verb: 'updated', itemType: 'to-do list', itemTitle: itemTitle(item) };
      }
      return { verb: 'edited', itemType: TYPE_LABELS[item.type] || item.type, itemTitle: itemTitle(item) };
    }

    case 'RENAME_BOARD':
      return { verb: 'renamed the board to', itemType: '', itemTitle: `"${action.name}"` };

    case 'SET_SETTINGS':
      return { verb: 'updated', itemType: 'board settings', itemTitle: '' };

    case 'SET_TYPOGRAPHY':
      return { verb: 'updated', itemType: 'typography settings', itemTitle: '' };

    default:
      return null;
  }
}

export function pushActivity(board, { name, verb, itemType, itemTitle: title, private: isPrivate }) {
  const entry = {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    name: name || 'Someone',
    verb,
    itemType,
    itemTitle: isPrivate ? '' : title,
    private: !!isPrivate,
  };
  const activity = [...(board.activity || []), entry].slice(-ACTIVITY_LIMIT);
  return { ...board, activity };
}

export function formatActivityEntry(entry) {
  const parts = [entry.verb];
  if (entry.itemType) parts.push(entry.itemType);
  if (entry.itemTitle) parts.push(`"${entry.itemTitle}"`);
  return parts.join(' ');
}
