import { useState, useEffect } from 'react';
import { fetchCompulsoryProducts } from '../api';

export default function CompulsoryCertification() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCompulsoryProducts(search).then(data => { setProducts(data); setLoading(false); });
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchCompulsoryProducts(search).then(data => { setProducts(data); setLoading(false); });
  };

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / Product Certification / <span className="active">Products under Compulsory Certification</span>
      </div>
      <h1 className="bis-page-title">Products under Compulsory Certification</h1>
      <p style={{ marginBottom: 16, fontSize: 13, color: '#555' }}>
        The following Indian Standards are under compulsory certification. Manufacturers must obtain BIS licence before manufacturing or selling these products.
      </p>
      <form onSubmit={handleSearch} className="bis-search-row">
        <input
          data-testid="compulsory-search-input"
          type="text"
          placeholder="Search by IS number, product name or keyword"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="bis-btn" data-testid="compulsory-search-btn">Search</button>
      </form>
      {loading ? <p>Loading...</p> : (
        <table className="bis-table" data-testid="compulsory-table">
          <thead>
            <tr>
              <th>Sr No.</th>
              <th>IS No.</th>
              <th>Product / Standard Title</th>
              <th>Scheme</th>
              <th>Status</th>
              <th>Product Manual</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.is_number} data-testid={`compulsory-row-${p.is_number.replace(/[^a-zA-Z0-9]/g, '-')}`}>
                <td>{i + 1}</td>
                <td>{p.is_number}</td>
                <td>{p.title}</td>
                <td>{p.scheme || 'ISI (Scheme-I)'}</td>
                <td><span style={{ color: '#c0392b', fontWeight: 600 }}>Mandatory</span></td>
                <td>
                  {p.manual_path ? (
                    <a href={p.manual_path} className="pdf-link" data-testid={`compulsory-manual-${p.is_number.replace(/[^a-zA-Z0-9]/g, '-')}`}>Download</a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
