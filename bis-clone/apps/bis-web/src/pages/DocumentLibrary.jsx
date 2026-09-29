import { useEffect, useMemo, useState } from 'react';
import { fetchDocuments, FILES } from '../api';

const LABELS = {
  process: 'Certification process',
  schemes: 'Schemes & QCOs',
  fees: 'Marking fees',
  manuals: 'Product manuals',
  standards: 'Standards documents',
  hallmarking: 'Hallmarking',
  labs: 'Labs & LRS',
  consumer: 'Consumer affairs',
  news: 'News / screenshots',
};

export default function DocumentLibrary() {
  const [docs, setDocs] = useState([]);
  const hitFile = (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('file') || ''
    : '').toLowerCase();

  useEffect(() => {
    fetchDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    for (const d of docs) {
      const key = d.domain || 'process';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [docs]);

  useEffect(() => {
    const hit = document.querySelector('.lib-hit');
    if (hit) {
      hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [docs]);

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / <span className="active">BIS Library</span>
      </div>
      <h1 className="bis-page-title">BIS document library</h1>
      <p style={{ marginBottom: 16, color: '#444' }}>
        {docs.length} official files from the BIS public corpus, grouped by function.
      </p>
      {Object.entries(grouped).map(([domain, rows]) => (
        <section key={domain} id={domain} style={{ marginBottom: 28, scrollMarginTop: 72 }}>
          <h3 style={{ color: '#003366', marginBottom: 8 }}>{LABELS[domain] || domain} ({rows.length})</h3>
          <ul className="process-pdf-list">
            {rows.map(d => {
              const isHit = hitFile && String(d.filename || '').toLowerCase() === hitFile;
              return (
              <li key={d.id} className={isHit ? 'lib-hit' : undefined}>
                <span className="process-pdf-icon">{/\.png|\.jpe?g/i.test(d.filename || d.pdf_path) ? '🖼' : '📄'}</span>
                <a
                  href={d.pdf_url || `${FILES}/${d.pdf_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pdf-link"
                >
                  {d.title}
                </a>
                {d.size_kb ? <span style={{ color: '#888', fontSize: 12 }}>({d.size_kb} KB)</span> : null}
              </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
