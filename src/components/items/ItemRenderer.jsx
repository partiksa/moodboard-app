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

export default function ItemRenderer({ item, board, dispatch, selected }) {
  const Content = RENDERERS[item.type];
  if (!Content) return null;

  const classes = ['canvas-item'];
  if (selected) classes.push('selected');
  if (item.locked) classes.push('locked');

  return (
    <div className={classes.join(' ')}>
      <div className="item-frame">
        <Content item={item} board={board} dispatch={dispatch} />
      </div>
      {item.privateNote && <PrivateNoteBadge note={item.privateNote} />}
    </div>
  );
}
