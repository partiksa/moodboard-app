import { useRef, useState } from 'react';
import { compressImage } from '../../utils/image';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

export default function ImageCard({ item, dispatch }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });

  const loadFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
      setError('Unsupported image format.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        compressImage(reader.result, file.type)
          .then((compressed) => update({ src: compressed.dataUrl, naturalWidth: compressed.width, naturalHeight: compressed.height }))
          .catch(() => setError('Could not process this image.'));
      } else {
        update({ src: reader.result });
      }
    };
    reader.onerror = () => setError('Could not read this image file.');
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
        onPaste={(e) => {
          e.stopPropagation(); // handled here for this placeholder; don't also trigger the board-wide paste handler
          const file = [...e.clipboardData.items].find((it) => it.type.startsWith('image/'))?.getAsFile();
          if (file) loadFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        tabIndex={0}
      >
        <p>Click, drop, or paste an image</p>
        {error && <p className="error-text">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.svg"
          style={{ display: 'none' }}
          onChange={(e) => loadFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  return <img className="image-card-img" src={item.src} alt={item.alt || ''} draggable={false} />;
}
