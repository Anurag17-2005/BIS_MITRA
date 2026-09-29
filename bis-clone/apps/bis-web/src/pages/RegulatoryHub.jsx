import { useEffect, useState } from 'react';
import { fetchGuidance, fetchQcoOrders, FILES } from '../api';

export default function RegulatoryHub() {
  const [guidance, setGuidance] = useState([]);
  const [qcos, setQcos] = useState([]);

  useEffect(() => {
    fetchGuidance().then(setGuidance).catch(() => {});
    fetchQcoOrders().then(setQcos).catch(() => {});
  }, []);

  return (
    <div>
      <div className="bis-breadcrumb"><a href="/">Home</a> / <span className="active">Regulatory Hub</span></div>
      <h1 className="bis-page-title">Regulatory Hub</h1>
      <h2 style={{ color: '#003366', fontSize: 16, margin: '20px 0 12px' }}>Quality Control Orders</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {qcos.map(q => (
          <div key={q.id} style={{ background: '#fff', border: '1px solid #ddd', padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <strong>{q.is_number}</strong> — {q.product}
              <div style={{ fontSize: 12, color: '#666' }}>{q.gazette_ref} · {q.ministry}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: q.enforcement_status === 'MANDATORY' ? '#c0392b' : '#e67e22' }}>
              {q.enforcement_status}
            </span>
          </div>
        ))}
      </div>
      <h2 style={{ color: '#003366', fontSize: 16, marginBottom: 12 }}>Guidance & Process Documents</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {guidance.map(g => (
          <article key={g.slug} style={{ background: '#fff', border: '1px solid #ddd', padding: 14 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#888' }}>{g.category}</span>
            <h3 style={{ fontSize: 13, color: '#003366', margin: '4px 0' }}>{g.title}</h3>
            <p style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>{g.content?.slice(0, 120)}…</p>
            {g.pdf_path && (
              <a href={g.pdf_url || `${FILES}/${g.pdf_path}`} target="_blank" rel="noreferrer" className="pdf-link" style={{ fontSize: 12 }}>
                Open PDF
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
