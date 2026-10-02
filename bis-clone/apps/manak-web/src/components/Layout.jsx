import { Link } from 'react-router-dom';

const BIS_URL = import.meta.env.VITE_BIS_URL || 'http://localhost:3001';

export default function Layout({ children }) {
  const logout = () => {
    localStorage.removeItem('manak_token');
    window.location.href = '/dashboard';
  };

  return (
    <div>
      <div className="warning-banner">Beware of fraudulent calls claiming to be from BIS. Report to complaints@bis.gov.in</div>
      <header className="manak-header">
        <div className="logo">
          <span style={{ fontSize: 24 }}>🔷</span>
          <div>
            <div style={{ fontSize: 12, color: '#003366', fontWeight: 700 }}>BUREAU OF INDIAN STANDARDS</div>
            <div style={{ fontSize: 10, color: '#666' }}>Ministry of Consumer Affairs, Government of India</div>
          </div>
        </div>
        <div className="ebis-title">eBIS</div>
        <div>
          <a href={BIS_URL} style={{ marginRight: 16, fontSize: 13, color: '#003366' }}>BIS Portal →</a>
          <button onClick={logout} style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
        </div>
      </header>
      <nav className="manak-nav">
        <Link to="/dashboard">Home</Link>
        <Link to="/conformity-assessment">Conformity Assessment</Link>
        <Link to="/marking-fee">Marking Fee</Link>
        <Link to="/standards-under-certification">Standards List</Link>
        <Link to="/applications">Applications</Link>
      </nav>
      <div className="manak-content">{children}</div>
    </div>
  );
}
