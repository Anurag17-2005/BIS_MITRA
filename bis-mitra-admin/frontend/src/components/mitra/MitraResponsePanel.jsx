/** Deterministic UI templates mapped from router uiMode — not LLM-generated. */
export default function MitraResponsePanel({ panel, uiMode }) {
  if (!panel || !uiMode || uiMode === 'chat') return null;

  if (uiMode === 'verification') {
    return (
      <div className="mitra-panel mitra-panel-verify">
        <div className="mitra-panel-head">✓ Verification</div>
        <p className="mitra-panel-status">{panel.status || '—'}</p>
        {panel.evidence?.status && <p className="mitra-panel-meta">Registry: {panel.evidence.status}</p>}
        {panel.evidence?.company_name && <p>{panel.evidence.company_name}</p>}
        {panel.ruleId && <p className="mitra-panel-meta">Rule {panel.ruleId}</p>}
      </div>
    );
  }

  if (uiMode === 'calculation') {
    return (
      <div className="mitra-panel mitra-panel-calc">
        <div className="mitra-panel-head">🧮 Calculation</div>
        {panel.result && (
          <p className="mitra-panel-highlight">
            {typeof panel.result === 'object' ? JSON.stringify(panel.result) : panel.result}
          </p>
        )}
        {panel.formula && <p className="mitra-panel-meta">{panel.formula}</p>}
      </div>
    );
  }

  if (uiMode === 'alert' && panel.alerts?.length) {
    return (
      <div className="mitra-panel mitra-panel-alert">
        <div className="mitra-panel-head">🔔 Alerts ({panel.alerts.length})</div>
        {panel.alerts.slice(0, 4).map((a, i) => (
          <div key={a.id || i} className="mitra-alert-row">
            <span>{a.title || a.alert_type}</span>
            <span className="mitra-badge">{a.priority || a.severity}</span>
          </div>
        ))}
      </div>
    );
  }

  if (uiMode === 'comparison' && panel.comparison) {
    const c = panel.comparison;
    return (
      <div className="mitra-panel mitra-panel-compare">
        <div className="mitra-panel-head">⇄ Comparison</div>
        <p>{c.is_number || c.title || 'Standard comparison'}</p>
        {panel.outcome && <p className="mitra-panel-meta">{panel.outcome}</p>}
      </div>
    );
  }

  if (uiMode === 'workflow') {
    const steps = Array.isArray(panel.steps) ? panel.steps : [];
    const isStatus = panel.status && !panel.required_documents?.length;
    return (
      <div className="mitra-panel mitra-panel-workflow">
        <div className="mitra-panel-head">{isStatus ? '📊 Status' : '📋'} {panel.service_name || (isStatus ? 'Application status' : 'Workflow')}</div>
        {panel.status && <p><strong>Status:</strong> {panel.status}</p>}
        {panel.current_step && <p><strong>Step:</strong> {panel.current_step}</p>}
        {panel.next_action && <p className="mitra-panel-meta">Next: {panel.next_action}</p>}
        {panel.record_id && <p className="mitra-panel-meta">ID: {panel.record_id}</p>}
        {panel.required_documents?.length > 0 && (
          <ul className="mitra-doc-list">
            {panel.required_documents.slice(0, 5).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        {steps.length > 0 && (
          <ol className="mitra-step-list">
            {steps.slice(0, 5).map((s, i) => (
              <li key={i}>{s.title || s.step || s}</li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (uiMode === 'knowledge' && panel.insufficient_evidence) {
    return (
      <div className="mitra-panel mitra-panel-warn">
        <p>⚠️ Insufficient indexed evidence — answer may be incomplete.</p>
      </div>
    );
  }

  if (uiMode === 'document') {
    return (
      <div className="mitra-panel mitra-panel-doc">
        <div className="mitra-panel-head">📄 Document</div>
        <p className="mitra-panel-meta">{panel.source || 'Generated template'}</p>
      </div>
    );
  }

  return null;
}
