import { Link } from 'react-router-dom';

const cards = [
  { to: '/standards-under-certification', label: 'Standards Under Certification', count: '5', color: '#6f42c1' },
  { to: 'http://localhost:3001/product-manuals', label: 'Product Manual', count: '5', color: '#17a2b8', external: true },
  { to: '/marking-fee', label: 'Marking Fee', count: '3', color: '#003366' },
  { to: '#', label: 'New Application(s)', count: '0', color: '#c0392b' },
];

export default function ConformityAssessment() {
  return (
    <div className="manak-page-card">
      <h1 className="page-title">Conformity Assessment</h1>
      <div className="tile-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {cards.map(c => (
          c.external ? (
            <a key={c.label} href={c.to} className="tile" style={{ background: c.color }}>
              <span className="tile-label">{c.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{c.count}</span>
            </a>
          ) : (
            <Link key={c.label} to={c.to} className="tile" style={{ background: c.color }}>
              <span className="tile-label">{c.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{c.count}</span>
            </Link>
          )
        ))}
      </div>
    </div>
  );
}
