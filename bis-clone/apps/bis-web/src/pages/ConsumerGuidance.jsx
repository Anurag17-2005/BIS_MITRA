import { useEffect, useState } from 'react';
import { fetchConsumerTopics, fetchGuidance, FILES } from '../api';

function pdfHref(item) {
  if (item.pdf_url) return item.pdf_url;
  if (item.pdf_path) return `${FILES}/${item.pdf_path}`;
  return null;
}

export default function ConsumerGuidance() {
  const [items, setItems] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetchConsumerTopics().then(setItems).catch(() => {});
    fetchGuidance('consumer').then(rows => {
      const list = Array.isArray(rows) ? rows.filter(r => /consumer|complaint/i.test(`${r.category} ${r.keywords} ${r.slug}`)) : [];
      setDocs(list);
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="bis-breadcrumb"><a href="/">Home</a> / <span className="active">Consumer Guidance</span></div>
      <h1 className="bis-page-title">Consumer Guidance</h1>
      <p style={{ color: '#555', marginBottom: 20, maxWidth: 760, lineHeight: 1.5 }}>
        How to file complaints, verify the ISI / CRS mark, and use recognised laboratories.
        Each topic includes the official BIS procedure and a downloadable PDF.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(t => {
          const href = pdfHref(t);
          return (
            <article key={t.slug} style={{ background: '#fff', border: '1px solid #ddd', padding: 20 }}>
              <span style={{ fontSize: 11, color: '#003366', fontWeight: 600 }}>{t.category}</span>
              <h3 style={{ color: '#003366', margin: '4px 0 8px' }}>{t.title}</h3>
              <p style={{ color: '#444', fontSize: 14, marginBottom: 10 }}>{t.summary}</p>
              {t.body && (
                <pre style={{
                  whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13,
                  color: '#333', lineHeight: 1.55, background: '#f7f9fc', padding: 12, borderRadius: 4,
                }}>{t.body}</pre>
              )}
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="pdf-link" style={{ display: 'inline-block', marginTop: 10 }}>
                  Open official PDF
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#888' }}>PDF attached after knowledge sync</span>
              )}
            </article>
          );
        })}
      </div>

      {docs.length > 0 && (
        <>
          <h2 style={{ color: '#003366', fontSize: 16, margin: '28px 0 12px' }}>Related consumer documents</h2>
          <ul className="process-pdf-list">
            {docs.map(d => {
              const href = pdfHref(d);
              return (
                <li key={d.slug}>
                  <span className="process-pdf-icon">📄</span>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="pdf-link">{d.title}</a>
                  ) : (
                    <span>{d.title}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
