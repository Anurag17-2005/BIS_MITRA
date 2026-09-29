import { sourceDisplayTitle, sourceToPdfUrl } from '../sourceUrl';

export default function MitraDocumentsPage({ messages, onOpenSource }) {
  const sources = [];
  const seen = new Set();
  for (const m of [...messages].reverse()) {
    if (m.role !== 'assistant' || !m.sources) continue;
    for (const s of m.sources) {
      const key = s.chunkId || s.source_file || s.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sources.push(s);
    }
  }

  return (
    <div className="mitra-page">
      <h2>📄 Documents</h2>
      <p className="mitra-panel-meta">BIS sources cited in your conversations and knowledge pack references.</p>
      {sources.length === 0 && (
        <p className="mitra-empty-inline">No documents yet — ask MITRA a question to see cited sources here.</p>
      )}
      <ul className="mitra-doc-page-list">
        {sources.map((s, i) => {
          const url = sourceToPdfUrl(s);
          return (
            <li key={s.chunkId || i} className="mitra-doc-card">
              <div>
                <strong>{sourceDisplayTitle(s)}</strong>
                {s.section && <span className="mitra-source-meta"> · {s.section}</span>}
              </div>
              {url && (
                <button type="button" className="btn btn-sm" onClick={() => onOpenSource(s, url)}>
                  View
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
