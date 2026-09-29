import { Link, useLocation } from 'react-router-dom';

const MANAK_URL = import.meta.env.VITE_MANAK_URL || 'http://localhost:3002';
const STANDARDS_URL = import.meta.env.VITE_STANDARDS_URL || 'http://localhost:3003';

function Soon({ label }) {
  return <Link to={`/coming-soon?page=${encodeURIComponent(label)}`}>{label} <small>(soon)</small></Link>;
}

export default function Layout({ children, sidebar = true }) {
  const loc = useLocation();
  const sideLinks = [
    { to: '/product-certification/overview', label: 'Overview' },
    { to: '/product-certification/compulsory', label: 'Products under Compulsory Certification' },
    { to: '/product-certification/process', label: 'Product Certification Process' },
    { to: '/product-manuals', label: 'Product Specific Information' },
    { to: '/apply-online', label: 'Apply Online' },
  ];

  return (
    <div>
      <header className="bis-top-header">
        <div className="bis-logo">
          <div className="bis-logo-icon" />
          <div className="bis-logo-text">
            <h1>Bureau of Indian Standards</h1>
            <p>The National Standards Body of India</p>
          </div>
        </div>
        <nav className="bis-top-nav">
          <Soon label="About Us" />
          <Soon label="Standards" />
          <Soon label="Conformity Assessment" />
          <Soon label="Laboratory Services" />
          <Soon label="Hallmarking" />
          <Soon label="Consumer Engagement" />
          <Soon label="Contact Us" />
          <a href={MANAK_URL} className="cross-link">eBIS Portal →</a>
          <a href={STANDARDS_URL} className="cross-link">Standards Portal →</a>
        </nav>
      </header>
      <nav className="bis-blue-nav">
        <Link to="/">Home</Link>
        <Link to="/news">News</Link>
        <a href={STANDARDS_URL}>Know Your Standard</a>
        <Link to="/product-manuals">Product Manuals</Link>
        <Link to="/product-certification/process">Certification Process</Link>
        <Link to="/product-certification/compulsory">Products under Compulsory Certification</Link>
        <Link to="/library">BIS Library</Link>
      </nav>
      {sidebar ? (
        <div className="bis-layout">
          <aside className="bis-sidebar">
            {sideLinks.map(l => (
              <Link key={l.to} to={l.to} className={loc.pathname === l.to ? 'active' : ''}>{l.label}</Link>
            ))}
          </aside>
          <main className="bis-content">{children}</main>
        </div>
      ) : (
        <main>{children}</main>
      )}
    </div>
  );
}
