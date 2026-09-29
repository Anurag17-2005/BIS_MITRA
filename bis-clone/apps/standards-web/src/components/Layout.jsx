import { Link } from 'react-router-dom';

const BIS_URL = import.meta.env.VITE_BIS_URL || 'http://localhost:3001';
const MANAK_URL = import.meta.env.VITE_MANAK_URL || 'http://localhost:3002';

export default function Layout({ children }) {
  return (
    <div>
      <header className="std-header">
        <div className="std-logo">
          <span style={{ fontSize: 32 }}>🔷</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#003366' }}>Bureau of Indian Standards</div>
            <div style={{ fontSize: 11, color: '#666' }}>The National Standards Body of India</div>
          </div>
        </div>
        <nav className="std-nav">
          <a href="/coming-soon?page=Standards">Standards (soon)</a>
          <a href="/coming-soon?page=Resources">Resources (soon)</a>
          <a href="/coming-soon?page=Programs">Programs & Initiatives (soon)</a>
          <a href={BIS_URL}>BIS Portal →</a>
          <a href={MANAK_URL}>eBIS →</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
