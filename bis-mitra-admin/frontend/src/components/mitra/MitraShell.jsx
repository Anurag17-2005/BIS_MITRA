import { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import { USER_PERSONAS } from '../../config/userPersonas';
import { useAgentChat } from '../../hooks/useAgentChat';
import MitraAgentView from './MitraAgentView';
import MitraContextPanel from './MitraContextPanel';
import PdfSourceViewer from './PdfSourceViewer';
import MitraDocumentsPage from './pages/MitraDocumentsPage';
import MitraApplicationsPage from './pages/MitraApplicationsPage';
import MitraAlertsPage from './pages/MitraAlertsPage';
import MitraProfilePage from './pages/MitraProfilePage';
import MitraSettingsPage from './pages/MitraSettingsPage';

const NAV = [
  { id: 'agent', icon: '🤖', label: 'Agent' },
  { id: 'documents', icon: '📄', label: 'Documents' },
  { id: 'applications', icon: '✅', label: 'Applications & Cases' },
  { id: 'alerts', icon: '🔔', label: 'Alerts' },
  { id: 'profile', icon: '👤', label: 'Profile' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function personaPrompts(persona) {
  return (persona.demoActions || [])
    .filter((a) => a.prompt)
    .map((a) => ({ id: a.id, label: a.label, prompt: a.prompt }));
}

export default function MitraShell({
  variant = 'user',
  clusterId,
  clusterName,
  clusters,
  onClusterChange,
  personaId,
  onPersonaChange,
  onMaintainerLogin,
  onNav,
  onSignOut,
  loading,
  error,
}) {
  const [page, setPage] = useState('agent');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const [pdfView, setPdfView] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [panelAlerts, setPanelAlerts] = useState([]);

  const {
    messages,
    busy,
    send,
    clear,
    persona,
    lastAssistant,
  } = useAgentChat({ clusterId, userPersona: personaId });

  const sessionId = api.getSessionId();
  const suggested = personaPrompts(persona);

  const refreshAlerts = useCallback(async () => {
    try {
      const [uc, ua, ca] = await Promise.all([
        api.getUserAlertUnreadCount(sessionId, personaId),
        api.getUserAlerts(sessionId, { userId: personaId }),
        api.getComplianceAlerts(true, personaId),
      ]);
      setUnreadAlerts(uc.count ?? uc.unread ?? 0);
      const combined = [...(ca.alerts || ca || []), ...(ua.alerts || ua || [])];
      setPanelAlerts(combined);
    } catch {
      setUnreadAlerts(0);
      setPanelAlerts([]);
    }
  }, [personaId, sessionId]);

  useEffect(() => {
    refreshAlerts();
    const t = setInterval(refreshAlerts, 20000);
    return () => clearInterval(t);
  }, [refreshAlerts]);

  const handleSend = useCallback(async (text) => {
    const msg = String(text || input).trim();
    if (!msg) return;
    setInput('');
    setPage('agent');
    await send(msg);
    refreshAlerts();
  }, [input, send, refreshAlerts]);

  const openSource = (source, url) => setPdfView({ source, url });

  const debug = lastAssistant?.meta
    ? {
        intent: lastAssistant.intent || lastAssistant.meta.intent,
        tool: lastAssistant.meta.tool,
        ruleId: lastAssistant.meta.ruleId,
        retrieval: lastAssistant.meta.retrieval,
        confidence: lastAssistant.meta.confidence,
      }
    : null;

  if (loading) {
    return <div className="mitra-shell mitra-loading">Loading BIS MITRA…</div>;
  }

  if (error) {
    return (
      <div className="mitra-shell mitra-error-wrap">
        <p className="warn">{error}</p>
        <p className="mitra-panel-meta">Start Clone B (:4000) and publish a cluster from the maintainer console.</p>
      </div>
    );
  }

  return (
    <div className={`mitra-shell mitra-variant-${variant}`}>
      <div className="mitra-persona-bar">
        <span className="mitra-persona-bar-label">View as:</span>
        <select
          className="mitra-persona-select"
          value={personaId}
          onChange={(e) => onPersonaChange(e.target.value)}
          aria-label="Demo persona"
        >
          {USER_PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>{p.short}</option>
          ))}
        </select>
        {variant === 'admin' && clusters?.length > 0 && (
          <select
            className="mitra-cluster-select"
            value={clusterId || ''}
            onChange={(e) => onClusterChange?.(e.target.value)}
            aria-label="Knowledge cluster"
          >
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.published ? ' ★' : ''}</option>
            ))}
          </select>
        )}
        {variant === 'user' && clusterName && (
          <span className="mitra-cluster-hint">Knowledge: {clusterName}</span>
        )}
        <div className="mitra-top-actions">
          {unreadAlerts > 0 && (
            <button type="button" className="mitra-alert-bell" onClick={() => setPage('alerts')} title="Alerts">
              🔔 <span className="mitra-badge-count">{unreadAlerts}</span>
            </button>
          )}
          {variant === 'user' && onMaintainerLogin && (
            <button type="button" className="btn btn-sm" onClick={onMaintainerLogin}>Maintainer</button>
          )}
        </div>
      </div>

      {variant === 'admin' && (
        <div className="mitra-admin-strip">
          <button type="button" className="btn btn-sm" onClick={() => onNav?.('clusters')}>← Maintainer console</button>
          <button type="button" className="btn btn-sm" onClick={() => window.open('?portal=user', '_blank', 'noopener')}>Open user portal</button>
          {onSignOut && <button type="button" className="btn btn-sm" onClick={onSignOut}>Sign out</button>}
        </div>
      )}

      <div className="mitra-body">
        <button
          type="button"
          className="mitra-mobile-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <nav className={`mitra-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="mitra-brand">
            <span className="mitra-brand-icon">🛡️</span>
            <div>
              <strong>BIS MITRA</strong>
              <span className="mitra-panel-meta">Intelligent Assistant</span>
            </div>
          </div>
          <ul className="mitra-nav">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={page === item.id ? 'active' : ''}
                  onClick={() => setPage(item.id)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === 'alerts' && unreadAlerts > 0 && (
                    <span className="mitra-nav-badge">{unreadAlerts}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="mitra-main">
          {page === 'agent' && (
            <MitraAgentView
              messages={messages}
              busy={busy}
              input={input}
              setInput={setInput}
              send={handleSend}
              clear={clear}
              persona={persona}
              onOpenSource={openSource}
              suggestedFollowUps={suggested}
            />
          )}
          {page === 'documents' && (
            <MitraDocumentsPage messages={messages} onOpenSource={openSource} />
          )}
          {page === 'applications' && (
            <MitraApplicationsPage personaId={personaId} onAskAbout={handleSend} />
          )}
          {page === 'alerts' && (
            <MitraAlertsPage personaId={personaId} sessionId={sessionId} onAskAbout={handleSend} />
          )}
          {page === 'profile' && <MitraProfilePage persona={persona} />}
          {page === 'settings' && (
            <MitraSettingsPage language={language} onLanguageChange={setLanguage} />
          )}
        </main>

        <button
          type="button"
          className="mitra-context-toggle"
          onClick={() => setContextOpen((o) => !o)}
          aria-label="Toggle context panel"
        >
          ◧
        </button>

        <div className={`mitra-context-wrap ${contextOpen ? 'open' : ''}`}>
          <MitraContextPanel
            persona={persona}
            lastAssistant={lastAssistant}
            suggestedPrompts={suggested}
            onRunPrompt={handleSend}
            onOpenSource={openSource}
            alerts={panelAlerts}
            debug={debug}
            showDebug={variant === 'admin'}
          />
        </div>
      </div>

      {pdfView && (
        <PdfSourceViewer
          source={pdfView.source}
          url={pdfView.url}
          onClose={() => setPdfView(null)}
        />
      )}
    </div>
  );
}
