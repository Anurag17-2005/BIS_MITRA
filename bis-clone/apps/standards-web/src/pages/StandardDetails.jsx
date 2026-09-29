import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getStandard, getReferredStandards, FILES } from '../api';

export default function StandardDetails() {
  const { isSlug } = useParams();
  const isNumber = decodeURIComponent(isSlug);
  const [std, setStd] = useState(null);
  const [referred, setReferred] = useState([]);
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    getStandard(isNumber).then(setStd);
    getReferredStandards(isNumber).then(setReferred);
  }, [isNumber]);

  if (!std) return <div className="std-detail-page"><p>Loading...</p></div>;

  return (
    <div className="std-detail-page">
      <div className="std-hero" style={{ padding: '24px 32px' }}>
        <h1 style={{ fontSize: 24 }}>Standard Details</h1>
        <div className="std-breadcrumb">
          <Link to="/" style={{ color: '#fff' }}>Home</Link> / Published Standards List / Standard Details
        </div>
      </div>
      <div className="std-detail-card" style={{ marginTop: 20 }}>
        <div className="std-detail-header">
          <div>
            <div className="std-is-number" data-testid="standard-title">{std.is_number}</div>
            <p style={{ marginTop: 8, color: '#555' }} data-testid="standard-description">{std.title}</p>
          </div>
          <span className="reviewed-tag" data-testid="standard-status">Reviewed In: {std.reviewed_year}</span>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
          Department: {std.department} | Committee: {std.committee} | Status: {std.status}
        </p>
      </div>
      <div className="std-detail-layout">
        <div className="std-tabs">
          {['basic', 'referred', 'manual'].map(t => (
            <button key={t} className={`std-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'basic' ? 'Basic Details' : t === 'referred' ? 'Standards Referred' : 'Product Manual & SIT'}
            </button>
          ))}
        </div>
        <div className="std-tab-content">
          {tab === 'basic' && (
            <div data-testid="tab-basic">
              <p><strong>IS Number:</strong> {std.is_number}</p>
              <p><strong>Title:</strong> {std.title}</p>
              <p><strong>Year:</strong> {std.year}</p>
              <p><strong>Mandatory/Voluntary:</strong> {std.mandatory_voluntary}</p>
              <p><strong>Description:</strong> {std.description}</p>
              {std.certification_applicability && (
                <p><strong>Certification:</strong> {std.certification_applicability}</p>
              )}
              {std.qco_reference && (
                <p><strong>QCO Reference:</strong> {std.qco_reference}</p>
              )}
              {std.amendment_status && (
                <p><strong>Amendment Status:</strong> {std.amendment_status}</p>
              )}
              {std.superseded_by_is && (
                <p><strong>Superseded By:</strong> <Link to={`/standard-details/${encodeURIComponent(std.superseded_by_is)}`}>{std.superseded_by_is}</Link></p>
              )}
            </div>
          )}
          {tab === 'referred' && (
            <div data-testid="referred-standards-list">
              <h3 style={{ marginBottom: 12 }}>Referred Indian Standards</h3>
              {referred.length === 0 ? <p>No referred standards.</p> : referred.map(r => (
                <div key={r.id} className="referred-item">
                  <strong>{r.referred_is}</strong> — Reviewed In: {r.reviewed_year}<br />
                  {r.title}
                </div>
              ))}
            </div>
          )}
          {tab === 'manual' && std.pdf_path && (
            <div data-testid="tab-manual">
              <a
                href={`${FILES}/${std.pdf_path}`}
                download
                className="pdf-link"
                data-testid="download-manual"
                style={{ color: '#003366', fontWeight: 600 }}
              >
                Download Product Manual (PDF)
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
