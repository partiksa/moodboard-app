import { useRef, useState } from 'react';

export default function VideoCard({ item, dispatch }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });

  const loadFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Unsupported video format.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => update({ src: reader.result, name: file.name });
    reader.onerror = () => setError('Could not read this video file.');
    reader.readAsDataURL(file);
  };

  if (!item.src) {
    return (
      <div
        className="image-dropzone"
        onDrop={(e) => {
          e.preventDefault();
          loadFile(e.dataTransfer.files?.[0]);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <p>Click or drop a video file</p>
        {error && <p className="error-text">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => loadFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <video
      className="video-card-el"
      src={item.src}
      controls
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
