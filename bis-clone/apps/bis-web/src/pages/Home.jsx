import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      <div className="bis-hero">
        <h2>Bureau of Indian Standards</h2>
        <p>Product Certification & Conformity Assessment</p>
      </div>
      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
        <h3 style={{ color: '#003366', marginBottom: 16 }}>Quick Links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Link to="/product-manuals" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Product Manuals</strong><br /><small>Search and download product manuals</small>
          </Link>
          <Link to="/product-certification/process" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Certification Process</strong><br /><small>Guidelines and process documents</small>
          </Link>
          <Link to="/product-certification/compulsory" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Compulsory Certification</strong><br /><small>Mandatory products list</small>
          </Link>
          <Link to="/apply-online" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Apply Online</strong><br /><small>Submit certification application</small>
          </Link>
          <Link to="/news" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>News &amp; Announcements</strong><br /><small>Latest BIS updates</small>
          </Link>
          <Link to="/consumer-guidance" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Consumer Guidance</strong><br /><small>Complaints, rights, mark verification</small>
          </Link>
          <Link to="/regulatory-hub" style={{ padding: 20, background: '#fff', border: '1px solid #ddd', borderRadius: 4, textDecoration: 'none', color: '#003366' }}>
            <strong>Regulatory Hub</strong><br /><small>QCOs, guidance, process documents</small>
          </Link>
          <Link to="/demo-console" style={{ padding: 20, background: '#fff3cd', border: '1px solid #e67e22', borderRadius: 4, textDecoration: 'none', color: '#856404' }}>
            <strong>Ministry Demo Console</strong><br /><small>Publish live portal changes → MITRA alerts</small>
          </Link>
        </div>
      </div>
    </div>
  );
}
