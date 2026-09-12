import { formatSwatchValues } from './color';

// Turns the board into a short, plain Markdown document meant to be pasted into an AI chat:
// only content, no coordinates, sizes or styling. Items are grouped by column and read in
// top-to-bottom, left-to-right order so the text follows the board's visual flow.

// Text cards store rich HTML; we keep links, lists, line breaks and emphasis as Markdown and
// drop every other tag.
function htmlToMarkdown(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = () => Array.from(node.childNodes).map(walk).join('');
    switch (tag) {
      case 'br': return '\n';
      case 'p': case 'div': return `${inner().trim()}\n`;
      case 'h1': case 'h2': case 'h3': case 'h4': return `\n${'#'.repeat(Number(tag[1]) + 1)} ${inner().trim()}\n`;
      case 'li': return `- ${inner().trim()}\n`;
      case 'ul': case 'ol': return `${inner()}\n`;
      case 'b': case 'strong': return `**${inner().trim()}**`;
      case 'i': case 'em': return `*${inner().trim()}*`;
      case 'a': return node.href ? `[${inner().trim() || node.href}](${node.href})` : inner();
      default: return inner();
    }
  };
  return walk(doc.body || doc.documentElement).replace(/\n{3,}/g, '\n\n').trim();
}

function byPosition(a, b) {
  return a.y - b.y || a.x - b.x;
}

function itemToMarkdown(item, { includePrivateNotes }) {
  let out = '';
  switch (item.type) {
    case 'text': {
      const text = htmlToMarkdown(item.body);
      if (text) out = text;
      break;
    }
    case 'image':
      out = `[Image${item.alt ? `: ${item.alt}` : ''}]`;
      break;
    case 'video':
      out = `[Video${item.name ? `: ${item.name}` : ''}]`;
      break;
    case 'attachment':
      out = `[Attachment: ${item.name || 'file'}${item.fileType ? ` (${item.fileType})` : ''}]`;
      break;
    case 'url':
      out = item.title ? `[${item.title}](${item.url})` : item.url;
      if (item.description) out += `\n${item.description}`;
      break;
    case 'color': {
      const v = formatSwatchValues(item.hex);
      out = `Color ${v.hex} (RGB ${v.rgb}, CMYK ${v.cmyk})`;
      break;
    }
    case 'todo': {
      const tasks = (item.tasks || []).filter((t) => t.text?.trim());
      out = tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text.trim()}`).join('\n');
      break;
    }
    default:
      break;
  }
  if (includePrivateNotes && item.privateNote?.trim()) {
    out += `${out ? '\n' : ''}> Note: ${item.privateNote.trim()}`;
  }
  return out;
}

export function boardToMarkdown(board, { includePrivateNotes = false } = {}) {
  const items = board.items || [];
  const columns = items.filter((i) => i.type === 'column').sort(byPosition);
  const inColumn = new Set(columns.flatMap((c) => c.childIds || []));
  const loose = items.filter((i) => i.type !== 'column' && !inColumn.has(i.id)).sort(byPosition);
  const opts = { includePrivateNotes };

  const lines = [`# ${board.name || 'Untitled board'}`, ''];

  const pushItems = (list) => {
    for (const item of list) {
      const md = itemToMarkdown(item, opts);
      if (md) lines.push(md, '');
    }
  };

  for (const col of columns) {
    lines.push(`## ${col.label || 'Column'}`, '');
    const children = (col.childIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
    pushItems(children);
  }
  if (loose.length) {
    if (columns.length) lines.push('## Other', '');
    pushItems(loose);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
