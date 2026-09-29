import { modeLabel } from './modeLabels';
import MitraSourceList from './MitraSourceList';

export default function MitraContextPanel({
  persona,
  lastAssistant,
  suggestedPrompts,
  onRunPrompt,
  onOpenSource,
  alerts,
  debug,
  showDebug,
}) {
  const uiMode = lastAssistant?.uiMode;
  const panel = lastAssistant?.panel;
  const intent = lastAssistant?.intent || lastAssistant?.meta?.intent;

  return (
    <aside className="mitra-context">
      <section className="mitra-context-block">
        <h4>Current context</h4>
        <p className="mitra-context-persona">{persona.icon} {persona.short}</p>
        {uiMode && <span className="mitra-mode-pill">{modeLabel(uiMode, intent)}</span>}
        {panel?.service_name && <p className="mitra-panel-meta">{panel.service_name}</p>}
        {panel?.record_id && <p className="mitra-panel-meta">Record: {panel.record_id}</p>}
        {panel?.status && <p>Status: <strong>{panel.status}</strong></p>}
      </section>

      {panel?.required_documents?.length > 0 && (
        <section className="mitra-context-block">
          <h4>Required documents</h4>
          <ul className="mitra-doc-list">
            {panel.required_documents.slice(0, 6).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      {panel?.next_action && (
        <section className="mitra-context-block">
          <h4>Next step</h4>
          <p>{panel.next_action}</p>
        </section>
      )}

      {suggestedPrompts?.length > 0 && (
        <section className="mitra-context-block">
          <h4>Suggested actions</h4>
          <div className="mitra-suggest-chips">
            {suggestedPrompts.slice(0, 6).map((p) => (
              <button key={p.id} type="button" className="mitra-chip-btn" onClick={() => onRunPrompt(p.prompt)}>
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {lastAssistant?.sources?.length > 0 && (
        <section className="mitra-context-block">
          <MitraSourceList sources={lastAssistant.sources} onOpenSource={onOpenSource} />
        </section>
      )}

      {alerts?.length > 0 && (
        <section className="mitra-context-block">
          <h4>Relevant alerts</h4>
          {alerts.slice(0, 3).map((a) => (
            <div key={a.id} className="mitra-alert-row">
              <span>{a.title}</span>
              <span className="mitra-badge">{a.priority || 'new'}</span>
            </div>
          ))}
        </section>
      )}

      {showDebug && debug && (
        <details className="mitra-context-block mitra-debug">
          <summary>Debug</summary>
          <p className="mitra-panel-meta">Intent: {debug.intent || '—'}</p>
          <p className="mitra-panel-meta">Tool: {debug.tool || '—'}</p>
          <p className="mitra-panel-meta">Rule: {debug.ruleId || '—'}</p>
          <p className="mitra-panel-meta">Retrieval: {debug.retrieval || '—'}</p>
          {debug.confidence != null && <p className="mitra-panel-meta">Confidence: {debug.confidence}</p>}
        </details>
      )}
    </aside>
  );
}
