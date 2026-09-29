import { useState } from 'react';
import { fetchMarkingFees } from '../api';

export default function MarkingFee() {
  const [mode, setMode] = useState('keyword');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const handleSearch = async () => {
    const data = await fetchMarkingFees(query);
    setResults(data);
    setSelected(null);
  };

  return (
    <div className="manak-page-card">
      <h1 className="page-title">Marking Fee</h1>
      <div className="fee-search-card">
        <label style={{ color: '#003366', fontWeight: 600, marginBottom: 12, display: 'block' }}>Search Product</label>
        <div className="radio-group">
          <label><input type="radio" name="mode" checked={mode === 'is'} onChange={() => setMode('is')} /> By IS Number</label>
          <label><input type="radio" name="mode" checked={mode === 'keyword'} onChange={() => setMode('keyword')} data-testid="fee-mode-keyword" /> By Keyword</label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            data-testid="fee-search-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={mode === 'keyword' ? 'e.g. helmet' : 'e.g. IS 4151'}
            style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 4 }}
          />
          <button onClick={handleSearch} className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} data-testid="fee-search-btn">Search Marking Fee</button>
        </div>
        {results.length > 0 && (
          <div className="fee-results" data-testid="fee-results">
            {results.map(r => (
              <div
                key={r.id}
                className={`fee-result-item ${selected?.id === r.id ? 'selected' : ''}`}
                data-testid={`fee-result-${r.is_number.replace(/[^a-zA-Z0-9]/g, '-')}`}
                onClick={() => setSelected(r)}
              >
                <strong>{r.is_number}</strong>: {r.title}
              </div>
            ))}
          </div>
        )}
        {selected && (
          <div className="fee-amount" data-testid="fee-amount">
            Marking Fee for {selected.is_number}: {selected.fee_amount}
          </div>
        )}
      </div>
    </div>
  );
}
