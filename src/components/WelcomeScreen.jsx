import { useState } from 'react';
import './WelcomeScreen.css';
import cursorFace from '../assets/cursor-face.png';

export default function WelcomeScreen({ boardId, onEnter, initialName = '' }) {
  const [name, setName] = useState(initialName);

  const submit = () => {
    if (!name.trim()) return;
    onEnter(name.trim());
  };

  return (
    <div className="welcome-screen" style={{ cursor: `url(${cursorFace}) 30 15, auto` }}>
      <div className="welcome-card">
        <h1>Welcome to Patkov Moodboard</h1>
        <p className="welcome-sub">Tell me your name</p>
        <input
          autoFocus
          className="welcome-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="welcome-btn" onClick={submit} disabled={!name.trim()}>
          {boardId ? 'Open board' : 'Continue'}
        </button>

        {!boardId && (
          <p className="welcome-note">
            You don&rsquo;t have a board link yet. Ask whoever invited you for a share link, then
            open it in this browser.
          </p>
        )}

        <p className="welcome-disclaimer">
          Anyone with this board&rsquo;s link can enter any name and fully edit the board. Names
          are just labels for attribution, not verified identities &mdash; don&rsquo;t share this
          link outside your trusted group.
        </p>
      </div>
    </div>
  );
}
