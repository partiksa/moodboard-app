import { X } from './icons.jsx';
import { formatActivityEntry } from '../lib/activity';
import './ActivityPanel.css';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ActivityPanel({ activity, onClose }) {
  const entries = [...activity].reverse();

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <span>Activity</span>
        <button className="icon-btn" onClick={onClose}>
          <X size={14} weight="bold" />
        </button>
      </div>
      <div className="activity-list">
        {entries.length === 0 && <p className="activity-empty">No activity yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="activity-row">
            <div className="activity-row-main">
              <strong>{entry.name}</strong> {formatActivityEntry(entry)}
            </div>
            <div className="activity-row-time">{formatTime(entry.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
