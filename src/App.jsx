import { useCallback, useEffect, useState } from 'react';
import BoardEditor from './components/BoardEditor.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import AdminApp from './components/admin/AdminApp.jsx';
import { useTheme } from './state/useTheme';
import { useHashRoute } from './lib/hashRoute';
import { getDisplayName, setDisplayName } from './lib/displayName';
import { loadBoard } from './lib/boardSync';
import { loadStoredCustomFonts } from './state/fontManager';
import './App.layout.css';

function useBoardLoader(boardId) {
  const [state, setState] = useState({ status: 'loading', board: null, sha: null, error: null });

  const load = useCallback(() => {
    if (!boardId) return;
    setState({ status: 'loading', board: null, sha: null, error: null });
    loadBoard(boardId)
      .then((result) => {
        if (!result) setState({ status: 'not_found', board: null, sha: null, error: null });
        else setState({ status: 'ready', board: result.board, sha: result.sha, error: null, offline: result.offline });
      })
      .catch((err) => setState({ status: 'error', board: null, sha: null, error: err.message }));
  }, [boardId]);

  useEffect(load, [load]);

  return { ...state, reload: load };
}

export default function App() {
  useTheme();
  const route = useHashRoute();
  const [collaboratorName, setCollaboratorName] = useState(() => getDisplayName());

  useEffect(() => {
    loadStoredCustomFonts().catch(() => {});
  }, []);

  const handleChangeName = useCallback((name) => {
    setDisplayName(name);
    setCollaboratorName(name);
  }, []);

  if (route.name === 'admin') {
    return <AdminApp />;
  }

  if (route.name === 'board') {
    if (!collaboratorName) {
      return <WelcomeScreen boardId={route.boardId} onEnter={handleChangeName} />;
    }
    return <BoardRoute boardId={route.boardId} collaboratorName={collaboratorName} onChangeName={handleChangeName} />;
  }

  return <WelcomeScreen boardId={null} onEnter={handleChangeName} initialName={collaboratorName} />;
}

function BoardRoute({ boardId, collaboratorName, onChangeName }) {
  const { status, board, sha, error, reload } = useBoardLoader(boardId);

  if (status === 'loading') {
    return <div className="app-loading">Loading board…</div>;
  }

  if (status === 'not_found') {
    return (
      <div className="app-empty">
        <p>This board link doesn&rsquo;t exist, or hasn&rsquo;t been created yet.</p>
        <p className="app-empty-hint">Ask the board owner to create it, or check the link.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app-empty">
        <p>Could not load this board.</p>
        <p className="app-empty-hint">{error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BoardEditor
        key={board.id}
        board={board}
        sha={sha}
        collaboratorName={collaboratorName}
        onChangeName={onChangeName}
      />
    </div>
  );
}
