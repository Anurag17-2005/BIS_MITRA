import { useEffect, useState } from 'react';
import * as api from '../../api';
import { getPersona } from '../../config/userPersonas';

function Stat({ label, value, tone }) {
  return (
    <div className="agent-stat">
      <span className="agent-stat-label">{label}</span>
      <span className={`agent-stat-value ${tone || ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function PersonaWorkspace({ personaId, onRunPrompt, onOpenBis }) {
  const persona = getPersona(personaId);
  const [data, setData] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);

  const reload = () => {
    setData(null);
    if (personaId === 'industry') {
      api.getIndustryProfile('DEMO_MSME').then(setData).catch(() => setData(null));
    } else if (personaId === 'citizen') {
      api.getCitizenProfile().then(setData).catch(() => setData(null));
    } else if (personaId === 'gold_investor') {
      api.getGoldProfile().then(setData).catch(() => setData(null));
    } else if (personaId === 'lab_testing') {
      api.getLabProfile().then(setData).catch(() => setData(null));
    } else if (personaId === 'foreign_exporter') {
      Promise.all([
        api.getCloneProbe('verify_import_compliance', 'LED').catch(() => null),
        api.getCloneProbe('check_treaty_alignment', 'Germany').catch(() => null),
      ]).then(([compliance, treaty]) => setData({ compliance, treaty }));
    } else if (personaId === 'enforcement') {
      api.getEnforcementProfile().then(setData).catch(() => setData(null));
    } else if (personaId === 'academic') {
      api.getAcademicProfile().then(setData).catch(() => setData(null));
    } else {
      api.getCloneProbe('search_consumer_guidance', 'complaint').then(setData).catch(() => {});
    }
  };

  useEffect(() => { reload(); }, [personaId]);

  const handleDemoAction = async (a) => {
    if (a.prompt) {
      onRunPrompt(a.prompt);
      return;
    }
    if (a.actionId) {
      setActionBusy(a.id);
      try {
        await api.runDemoAction(a.actionId);
        reload();
      } catch (err) {
        alert(err.message || 'Demo action failed');
      } finally {
        setActionBusy(null);
      }
      return;
    }
    if (a.bisPath) onOpenBis(a.bisPath);
  };

  return (
    <section className="agent-section agent-workspace">
      <header className="agent-section-head">
        <span className="agent-section-icon">{persona.icon}</span>
        <div>
          <h2>{persona.short} workspace</h2>
          <p>{persona.description}</p>
        </div>
      </header>

      <div className="agent-workspace-grid">
        <div className="agent-card">
          <h3>Live status</h3>
          {personaId === 'industry' && data && (
            <div className="agent-stat-row">
              <Stat label="Licences" value={data.active_licence_count} tone="ok" />
              <Stat label="Pending" value={data.pending_applications} />
              <Stat label="MSME" value={data.udyam_status} tone="ok" />
            </div>
          )}
          {personaId === 'citizen' && data && (
            <div className="agent-stat-row">
              <Stat label="Grievance" value={data.grievance_ticket || 'CON-GRP-4401'} />
              <Stat label="Status" value={(data.grievance_status || 'OFFICER_ASSIGNED').replace(/_/g, ' ')} tone="ok" />
              <Stat label="Registry" value={data.sample_registry?.status || 'EXPIRED'} tone="warn" />
              <Stat label="Hazards" value={data.hazard_reports ?? 0} />
            </div>
          )}
          {personaId === 'lab_testing' && data && (
            <div className="agent-stat-row">
              <Stat label="IS 1786 temp" value={data.environmental_spec?.ambient_temp_c || '27°C ±2'} />
              <Stat label="Certs logged" value={data.certificates_logged ?? 0} tone="ok" />
              <Stat label="Blind batch" value={data.blind_batch || 'BLIND-X1'} />
            </div>
          )}
          {personaId === 'gold_investor' && data && (
            <div className="agent-stat-row">
              <Stat label="Sample stamp" value={data.sample_stamp?.stamp || '22K916'} tone="ok" />
              <Stat label="HUID" value={data.sample_huid?.huid || 'A1B2C3'} />
              <Stat label="AHC centres" value={data.hallmarking_centres ?? '5+'} />
            </div>
          )}
          {personaId === 'foreign_exporter' && (
            <div className="agent-stat-row">
              <Stat label="FMCS/CRS items" value={data?.compliance?.data?.resultCount ?? (data?.compliance?.data ? 1 : '—')} />
              <Stat label="MRA active" value={data?.treaty?.data?.results?.[0]?.agreement_type || '—'} tone="ok" />
            </div>
          )}
          {personaId === 'enforcement' && data && (
            <div className="agent-stat-row">
              <Stat label="Licence" value={`CM/L-${data.suspended_license?.cml_number || '8830112'}`} />
              <Stat label="Status" value={data.suspended_license?.status || 'SUSPENDED'} tone="warn" />
              <Stat label="Evidence" value={data.evidence_entries ?? 0} />
            </div>
          )}
          {personaId === 'academic' && data && (
            <div className="agent-stat-row">
              <Stat label="Publications" value={data.semester_publications ?? 0} tone="ok" />
              <Stat label="Diff rows" value={data.revision_diffs ?? 0} />
              <Stat label="Featured" value={data.featured_standard || 'IS 4151'} />
            </div>
          )}
        </div>

        <div className="agent-card">
          <h3>Prove it live</h3>
          <p className="row-sub" style={{ marginBottom: 8 }}>
            Change data on BIS → alert appears here for this persona only.
          </p>
          <div className="agent-action-chips">
            {persona.demoActions.map(a => (
              <button
                key={a.id}
                type="button"
                className="btn btn-sm"
                disabled={actionBusy === a.id}
                onClick={() => handleDemoAction(a)}
              >
                {actionBusy === a.id ? '…' : a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
