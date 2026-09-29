import { useState, useEffect } from 'react';
import { fetchProcessDocs, FILES } from '../api';

export default function CertificationProcess() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetchProcessDocs().then(setDocs);
  }, []);

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / Product Certification / <span className="active">Product Certification Process</span>
      </div>
      <h1 className="bis-page-title">Product Certification Process</h1>
      <h3 style={{ marginBottom: 12, color: '#003366' }}>Scheme-I of BIS (Conformity Assessment) Regulations, 2018</h3>
      <ul className="process-pdf-list" data-testid="process-pdf-list">
        {docs.map(d => (
          <li key={d.id}>
            <span className="process-pdf-icon">📄</span>
            <a
              href={d.pdf_url || `${FILES}/${d.pdf_path}`}
              target="_blank"
              rel="noreferrer"
              className="pdf-link"
              data-testid={`process-pdf-${d.id}`}
            >
              {d.title}
            </a>
            <span style={{ color: '#888', fontSize: 12 }}>({d.size_kb} KB)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
