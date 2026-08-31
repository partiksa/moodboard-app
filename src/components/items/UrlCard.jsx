import { useState } from 'react';

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
      {!loading && !item.failed && item.image && (
        <img className="url-card-image" src={item.image} alt="" />
      )}
      <div className="url-card-body">
        <div className="url-card-title">{item.title || hostname}</div>
        {item.description && <div className="url-card-desc">{item.description}</div>}
        <div className="url-card-host">{hostname}</div>
        {item.failed && <div className="url-card-fallback-note">Preview unavailable — showing basic link.</div>}
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
