import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../../utils/image';

async function fetchMetadata(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('bad status');
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (prop) =>
    doc.querySelector(`meta[property="${prop}"]`)?.content || doc.querySelector(`meta[name="${prop}"]`)?.content || '';
  return {
    title: meta('og:title') || doc.querySelector('title')?.textContent || url,
    description: meta('og:description') || meta('description') || '',
    image: meta('og:image') || '',
  };
}

export default function UrlCard({ item, dispatch }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });

  const submitUrl = async (raw) => {
    let normalized = raw.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    update({ url: normalized });
    setLoading(true);
    try {
      const meta = await fetchMetadata(normalized);
      update({ ...meta, url: normalized, fetchedAt: new Date().toISOString(), failed: false });
    } catch {
      update({ url: normalized, fetchedAt: new Date().toISOString(), failed: true });
    } finally {
      setLoading(false);
    }
  };

  // A url can arrive already set (e.g. pasted straight onto the board) without ever going
  // through submitUrl, so fetch its preview metadata once as soon as it shows up.
  useEffect(() => {
    if (item.url && !item.fetchedAt) {
      setLoading(true);
      fetchMetadata(item.url)
        .then((meta) => update({ ...meta, fetchedAt: new Date().toISOString(), failed: false }))
        .catch(() => update({ fetchedAt: new Date().toISOString(), failed: true }))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.url]);

  const onPickPreviewImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      compressImage(reader.result, file.type).then((compressed) => {
        update({ image: compressed ? compressed.dataUrl : reader.result });
      });
    };
    reader.readAsDataURL(file);
  };

  if (!item.url) {
    return (
      <div className="url-input-box" onMouseDown={(e) => e.stopPropagation()}>
        <input
          placeholder="Paste a URL and press Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) submitUrl(e.currentTarget.value);
          }}
        />
      </div>
    );
  }

  const hostname = safeHostname(item.url);

  return (
    <a
      className="url-card"
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      {loading && <div className="url-loading">Fetching preview…</div>}
      {!loading && item.image && <img className="url-card-image" src={item.image} alt="" />}
      <div className="url-card-body">
        <div className="url-card-title">{item.title || hostname}</div>
        {item.description && <div className="url-card-desc">{item.description}</div>}
        <div className="url-card-host">{hostname}</div>
        {!loading && !item.image && (
          <>
            <div className="url-card-fallback-note">No preview found for this link.</div>
            <button
              className="url-card-add-preview"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Add preview image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickPreviewImage}
            />
          </>
        )}
      </div>
    </a>
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
