import TextCard from './TextCard.jsx';
import ImageCard from './ImageCard.jsx';
import VideoCard from './VideoCard.jsx';
import AttachmentCard from './AttachmentCard.jsx';
import UrlCard from './UrlCard.jsx';
import ColorSwatchCard from './ColorSwatchCard.jsx';
import TodoCard from './TodoCard.jsx';
import ColumnCard from './ColumnCard.jsx';
import PrivateNoteBadge from './PrivateNoteBadge.jsx';

const RENDERERS = {
  text: TextCard,
  image: ImageCard,
  video: VideoCard,
  attachment: AttachmentCard,
  url: UrlCard,
  color: ColorSwatchCard,
  todo: TodoCard,
  column: ColumnCard,
};

export default function ItemRenderer({
  item,
  board,
  dispatch,
  selected,
  highlighted,
  dropTarget,
  onMouseDown,
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
      onMouseDown={onMouseDown}
      data-item-id={item.id}
    >
      <div className="item-frame">
        <Content item={item} board={board} dispatch={dispatch} />
      </div>

      {item.privateNote && <PrivateNoteBadge note={item.privateNote} />}

      {selected && !item.locked && (
        <>
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
            <div
              key={handle}
              className={`resize-handle ${handle} ${handle.length === 2 ? 'corner' : 'edge'}`}
              onMouseDown={(e) => onResizeStart(e, item, handle)}
            />
          ))}
          <div className="rotate-handle" onMouseDown={(e) => onRotateStart(e, item)} />
        </>
      )}
    </div>
  );
}
