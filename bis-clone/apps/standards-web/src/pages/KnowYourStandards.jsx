import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchStandards } from '../api';

function toSlug(isNumber) {
  return isNumber.replace(/[^a-zA-Z0-9]/g, '-');
}

export default function KnowYourStandards() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    const data = await searchStandards(query);
    setResults(data);
    setSearched(true);
  };

  return (
    <div>
      <div className="std-hero">
        <h1>Know Your Standards</h1>
        <div className="std-breadcrumb">
          <Link to="/">Home</Link> / Published Standards / Know Your Standards
        </div>
      </div>
      <div className="std-search-section">
        <form onSubmit={handleSearch} className="std-search-box">
          <input
            data-testid="standard-search"
            type="text"
            placeholder="Search Indian Standards (IS) By Number or Keywords"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" data-testid="standard-search-btn">Search</button>
        </form>
      </div>
      <div className="std-results" data-testid="search-results">
        {!searched && <p style={{ color: '#999', textAlign: 'center' }}>Results will appear here</p>}
        {results.map(r => (
          <div key={r.id} className="std-result-item" data-testid={`result-${toSlug(r.is_number)}`}>
            <Link to={`/standard-details/${encodeURIComponent(r.is_number)}`}>
              {r.is_number}
              {r.status === 'Withdrawn' && <span className="withdrawn">WITHDRAWN</span>}
            </Link>
            <p>{r.title}</p>
            <small style={{ color: '#888' }}>Published In: {r.year} | {r.mandatory_voluntary}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
