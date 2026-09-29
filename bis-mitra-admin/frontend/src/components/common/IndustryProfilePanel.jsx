import { useEffect, useState } from 'react';
import * as api from '../../api';

export default function IndustryProfilePanel() {
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  const load = () => {
    api.getIndustryProfile('DEMO_MSME')
      .then(setProfile)
      .catch(e => setErr(e.message));
  };

  useEffect(() => { load(); }, []);

  if (err) {
    return <div className="industry-panel row-sub">Profile tracker offline — start Clone B on :4000</div>;
  }
  if (!profile) return <div className="industry-panel row-sub">Loading org profile…</div>;

  return (
    <div className="industry-panel">
      <div className="industry-panel-head">
        <strong>Submission Tracker</strong>
        <span className="chip">{profile.org_id}</span>
        <button type="button" className="btn btn-sm" onClick={load}>Refresh</button>
      </div>
      <div className="industry-panel-grid">
        <div className="industry-stat">
          <span className="stat-label">Active licences</span>
          <span className="stat-value">{profile.active_licence_count}</span>
        </div>
        <div className="industry-stat">
          <span className="stat-label">Pending apps</span>
          <span className="stat-value">{profile.pending_applications}</span>
        </div>
        <div className="industry-stat">
          <span className="stat-label">MSME status</span>
          <span className="stat-value">{profile.udyam_status}</span>
        </div>
      </div>
      {profile.applications?.length > 0 && (
        <ul className="industry-apps">
          {profile.applications.slice(0, 4).map(a => (
            <li key={a.reference_id}>
              <code>{a.reference_id}</code>
              <span>{a.is_number}</span>
              <span className={`chip ${a.status === 'Granted' ? 'chip-ok' : ''}`}>{a.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
