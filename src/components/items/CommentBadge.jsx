import { useState } from 'react';
import { ChatCircle, X } from '../icons.jsx';
import { getDisplayName } from '../../lib/displayName';
import { uid } from '../../utils/id';

// Comments live on the item as { id, text, author, createdAt }. The "Comment" button shows
// on hover of any item; existing comments collapse into a small badge that expands on hover
// so the board itself stays uncluttered.
export default function CommentBadge({ item, dispatch }) {
  const comments = item.comments || [];
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const setComments = (next) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { comments: next } });

  const submit = () => {
    const text = draft.trim();
    if (text) {
      setComments([
        ...comments,
        { id: uid('comment'), text, author: getDisplayName() || 'Anonymous', createdAt: new Date().toISOString() },
      ]);
    }
    setDraft('');
    setComposing(false);
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className="comment-area" onMouseDown={stop} onDoubleClick={stop}>
      {!composing && (
        <button
          type="button"
          className="comment-add-btn"
          title="Add comment"
          onClick={(e) => {
            e.stopPropagation();
            setComposing(true);
          }}
        >
          <ChatCircle size={11} weight="bold" />
          Comment
        </button>
      )}

      {composing && (
        <div className="comment-composer">
          <textarea
            autoFocus
            rows={2}
            placeholder="Write a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape') {
                setDraft('');
                setComposing(false);
              }
            }}
          />
          <div className="comment-composer-actions">
            <button type="button" onClick={() => { setDraft(''); setComposing(false); }}>Cancel</button>
            <button type="button" className="primary" onClick={submit} disabled={!draft.trim()}>Post</button>
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div className="comment-badge" title={`${comments.length} comment(s)`}>
          <ChatCircle size={10} weight="fill" />
          <span>{comments.length}</span>
          <div className="comment-list">
            {comments.map((c) => (
              <div key={c.id} className="comment-entry">
                <div className="comment-meta">
                  <span className="comment-author">{c.author || 'Anonymous'}</span>
                  <button
                    type="button"
                    className="comment-remove"
                    title="Delete comment"
                    onClick={() => setComments(comments.filter((x) => x.id !== c.id))}
                  >
                    <X size={9} weight="bold" />
                  </button>
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
