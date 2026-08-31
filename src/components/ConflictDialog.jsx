import './ConflictDialog.css';

export default function ConflictDialog({ onReload, onOverwrite }) {
  return (
    <div className="conflict-overlay">
      <div className="conflict-dialog">
        <h3>Someone else saved changes</h3>
        <p>
          This board was updated on GitHub since it was last loaded here. Choose how to continue
          &mdash; your current edits are safely kept locally either way until you pick one.
        </p>
        <div className="conflict-actions">
          <button className="tool-btn" onClick={onReload}>Reload remote version</button>
          <button className="tool-btn primary" onClick={onOverwrite}>Overwrite with my version</button>
        </div>
      </div>
    </div>
  );
}
