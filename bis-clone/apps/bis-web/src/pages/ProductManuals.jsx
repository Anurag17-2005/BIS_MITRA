import { useState, useEffect } from 'react';
import { fetchManuals, patchManual, FILES } from '../api';

export default function ProductManuals() {
  const [manuals, setManuals] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const load = (q = search) => {
    setLoading(true);
    fetchManuals(q).then(data => { setManuals(data); setLoading(false); });
  };

  useEffect(() => { load(); }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const startRename = (m) => {
    setRenameId(m.id);
    setRenameValue(m.pdf_path?.split('/').pop() || '');
  };

  const saveRename = async (m) => {
    const fileName = renameValue.trim();
    if (!fileName) return;
    const folder = m.pdf_path.includes('/') ? m.pdf_path.slice(0, m.pdf_path.lastIndexOf('/') + 1) : 'manuals/';
    await patchManual(m.id, { pdf_path: `${folder}${fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`}` });
    setRenameId(null);
    load();
  };

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / Product Certification / Product Specific Information / <span className="active">Product Manuals</span>
      </div>
      <h1 className="bis-page-title">Product Manuals (Clarification on its provisions)</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        Official BIS product manuals from bis.gov.in knowledge repository. All PDFs are downloadable.
      </p>
      <form onSubmit={handleSearch} className="bis-search-row">
        <input
          data-testid="manual-search-input"
          type="text"
          placeholder="Search for IS No."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="bis-btn" data-testid="manual-search-btn">Search</button>
      </form>
      {loading ? <p>Loading...</p> : (
        <table className="bis-table" data-testid="manuals-table">
          <thead>
            <tr>
              <th>Sr No.</th><th>IS No.</th><th>Title</th><th>Size</th><th>Format</th><th>Document</th><th>Download</th><th>Demo</th>
            </tr>
          </thead>
          <tbody>
            {manuals.map(m => (
              <tr key={m.id} data-testid={`manual-row-${m.is_number.replace(/[^a-zA-Z0-9]/g, '-')}`}>
                <td>{m.sr_no}</td>
                <td>{m.is_number}</td>
                <td>{m.title}</td>
                <td>{m.size_mb} MB</td>
                <td>Pdf</td>
                <td>
                  {renameId === m.id ? (
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      style={{ width: 160, padding: 4 }}
                      data-testid="manual-rename-input"
                    />
                  ) : (
                    <a href={m.pdf_url || `${FILES}/${m.pdf_path}`} target="_blank" rel="noreferrer" className="pdf-link">
                      {m.pdf_path?.split('/').pop()}
                    </a>
                  )}
                </td>
                <td>
                  <a
                    href={m.pdf_url || `${FILES}/${m.pdf_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pdf-link"
                    data-testid={`download-${m.is_number.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >Download</a>
                </td>
                <td>
                  {renameId === m.id ? (
                    <>
                      <button type="button" className="bis-btn" onClick={() => saveRename(m)}>Save</button>
                      {' '}
                      <button type="button" className="bis-btn" onClick={() => setRenameId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="bis-btn" onClick={() => startRename(m)}>Rename file</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
