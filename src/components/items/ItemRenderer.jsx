import TextCard from './TextCard.jsx';
import ImageCard from './ImageCard.jsx';
import VideoCard from './VideoCard.jsx';
import AttachmentCard from './AttachmentCard.jsx';
import UrlCard from './UrlCard.jsx';
import ColorSwatchCard from './ColorSwatchCard.jsx';
import TodoCard from './TodoCard.jsx';
import ColumnCard from './ColumnCard.jsx';
import DrawingCard from './DrawingCard.jsx';
import PrivateNoteBadge from './PrivateNoteBadge.jsx';
import CommentBadge from './CommentBadge.jsx';
import { isHeadingCard } from '../../utils/textCard';

const RENDERERS = {
  text: TextCard,
  image: ImageCard,
  video: VideoCard,
  attachment: AttachmentCard,
  url: UrlCard,
  color: ColorSwatchCard,
  todo: TodoCard,
  column: ColumnCard,
  drawing: DrawingCard,
};

export default function ItemRenderer({
  item,
  board,
  dispatch,
  selected,
  highlighted,
  dropTarget,
  onPointerDown,
  onResizeStart,
  onRotateStart,
}) {
  const Content = RENDERERS[item.type];
  if (!Content) return null;

  const classes = ['canvas-item'];
  if (selected) classes.push('selected');
  if (highlighted) classes.push('highlighted');
  if (dropTarget) classes.push('drop-target');
  if (item.locked) classes.push('locked');
  // a heading-only text card draws just its text, without the card box
  if (item.type === 'text' && isHeadingCard(item.body)) classes.push('frameless');
  if (item.type === 'drawing') classes.push('frameless', 'is-drawing');

  return (
    <div
      className={classes.join(' ')}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        transform: `rotate(${item.rotation || 0}deg)`,
        zIndex: item.zIndex,
      }}
      onPointerDown={onPointerDown}
      data-item-id={item.id}
    >
      <div className="item-frame">
        <Content item={item} board={board} dispatch={dispatch} />
      </div>

      {item.privateNote && <PrivateNoteBadge note={item.privateNote} />}
      <CommentBadge item={item} dispatch={dispatch} />

      {selected && !item.locked && (
        <>
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
            <div
              key={handle}
              className={`resize-handle ${handle} ${handle.length === 2 ? 'corner' : 'edge'}`}
              onPointerDown={(e) => onResizeStart(e, item, handle)}
            />
          ))}
          <div className="rotate-handle" onPointerDown={(e) => onRotateStart(e, item)} />
        </>
      )}
    </div>
  );
}
