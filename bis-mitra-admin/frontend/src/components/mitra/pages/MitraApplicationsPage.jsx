import { useEffect, useState } from 'react';
import * as api from '../../../api';

function recordsForPersona(personaId, data) {
  if (!data) return [];
  if (personaId === 'citizen') {
    return [{
      id: data.grievance_ticket || 'CON-GRP-4401',
      type: 'Complaint',
      status: (data.grievance_status || 'OFFICER_ASSIGNED').replace(/_/g, ' '),
      date: 'Recent',
    }];
  }
  if (personaId === 'industry' || personaId === 'foreign_exporter') {
    return (data.applications || data.recent_applications || []).length
      ? (data.applications || data.recent_applications)
      : [{
          id: data.application_id || 'BIS-APP-CERT-DEMO-001',
          type: 'Product certification',
          status: data.pending_applications ? 'Under review' : 'Active',
          date: 'Demo',
        }];
  }
  if (personaId === 'gold_investor') {
    return [{ id: 'HUID-A1B2C3', type: 'HUID verification', status: 'Active', date: 'Demo' }];
  }
  if (personaId === 'lab_testing') {
    return [{ id: 'LAB-REC-2026-001', type: 'Lab recognition', status: 'Inspection scheduled', date: 'Demo' }];
  }
  if (personaId === 'enforcement') {
    return [{ id: data.case_id || 'ENF-RAID-001', type: 'Enforcement case', status: data.suspended_license?.status || 'Open', date: 'Demo' }];
  }
  if (personaId === 'academic') {
    return [{ id: 'RES-STD-4151', type: 'Standards research', status: 'In progress', date: 'Demo' }];
  }
  return [];
}

export default function MitraApplicationsPage({ personaId, onAskAbout }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const loaders = {
      industry: () => api.getIndustryProfile('DEMO_MSME'),
      citizen: () => api.getCitizenProfile(),
      gold_investor: () => api.getGoldProfile(),
      lab_testing: () => api.getLabProfile(),
      enforcement: () => api.getEnforcementProfile(),
      academic: () => api.getAcademicProfile(),
      foreign_exporter: () => api.getIndustryProfile('DEMO_MSME'),
    };
    (loaders[personaId] || loaders.citizen)().then(setData).catch(() => setData(null));
  }, [personaId]);

  const records = recordsForPersona(personaId, data);

  return (
    <div className="mitra-page">
      <h2>✅ Applications &amp; cases</h2>
      {records.length === 0 && <p className="mitra-empty-inline">No records for this persona.</p>}
      <div className="mitra-app-grid">
        {records.map((r) => (
          <div key={r.id} className="mitra-app-card">
            <div className="mitra-app-card-head">
              <strong>{r.id}</strong>
              <span className="mitra-badge">{r.status}</span>
            </div>
            <p className="mitra-panel-meta">{r.type}</p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => onAskAbout(`What is the status of ${r.id}?`)}
            >
              Ask MITRA
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
