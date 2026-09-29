import { Link } from 'react-router-dom';

const tiles = [
  { to: '/apply', label: 'Form-I Application (Scheme-I)', color: '#c0392b', icon: '📝' },
  { to: '/applications', label: 'My Applications', color: '#0f766e', icon: '📄' },
  { to: '/conformity-assessment', label: 'Conformity Assessment (Manakonline)', color: '#17a2b8', icon: '📋' },
  { to: '/marking-fee', label: 'Marking Fee', color: '#6f42c1', icon: '💰' },
  { to: '/standards-under-certification', label: 'Standards Under Certification', color: '#003366', icon: '📊' },
  { to: '/coming-soon?page=CRS', label: 'Compulsory Registration Scheme (CRS) — soon', color: '#1a5276', icon: '🔗' },
  { to: '/coming-soon?page=Hallmarking', label: 'Hallmarking — soon', color: '#d4a017', icon: '💍' },
  { to: '/coming-soon?page=Laboratory', label: 'Laboratory — soon', color: '#28a745', icon: '🔬' },
  { to: '/coming-soon?page=FMCS', label: 'Know About FMCS — soon', color: '#8b4513', icon: '🌐' },
  { to: '/coming-soon?page=Training', label: 'Training — soon', color: '#007bff', icon: '🎓' },
  { to: '/coming-soon?page=Important%20Links', label: 'Important Links — soon', color: '#6b8e23', icon: '🔗' },
];

export default function Dashboard() {
  return (
    <div>
      <h1 className="page-title">eBIS Dashboard</h1>
      <div className="tile-grid" data-testid="dashboard-tiles">
        {tiles.map(t => (
          <Link key={t.label} to={t.to} className="tile" style={{ background: t.color }}>
            <span className="tile-icon">{t.icon}</span>
            <span className="tile-label">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
