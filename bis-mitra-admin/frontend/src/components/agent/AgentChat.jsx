import { useState, useEffect } from 'react';
import * as api from '../../api';
import ComplianceAlertBanner from '../common/ComplianceAlertBanner';
import PersonaWorkspace from './PersonaWorkspace';
import { getPersona } from '../../config/userPersonas';
import { config } from '../../config.js';

const BIS_URL = config.bisUrl;

function SourceList({ sources }) {
  if (!sources?.length) return null;
  return (
    <details className="agent-sources-fold">
      <summary>{sources.length} source(s)</summary>
      <ul className="agent-sources">
        {sources.map((s, i) => (
          <li key={s.chunkId || s.recordId || i}>
            <strong>{s.citationAnchor || s.title || s.recordId}</strong>
            {s.demo_id && <span className="src-sec"> · {s.demo_id}</span>}
            {s.source_file && <span className="src-sec"> · {s.source_file}</span>}
            {s.section && <span className="src-sec"> · {s.section}</span>}
            {s.retrievalMethod && <span className="src-sec"> · {s.retrievalMethod}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ResponsePanel({ panel, uiMode }) {
  if (!panel || !uiMode || uiMode === 'chat') return null;

  if (uiMode === 'verification') {
    return (
      <div className="agent-response-panel verification-panel">
        <h4>Verification</h4>
        <p><strong>Status:</strong> {panel.status || '—'}</p>
        {panel.evidence?.status && <p>Registry: {panel.evidence.status}</p>}
        {panel.evidence?.company_name && <p>{panel.evidence.company_name}</p>}
      </div>
    );
  }

  if (uiMode === 'calculation') {
    return (
      <div className="agent-response-panel calculation-panel">
        <h4>Calculation</h4>
        {panel.result && <p className="calc-result">{typeof panel.result === 'object' ? JSON.stringify(panel.result) : panel.result}</p>}
        {panel.formula && <p className="row-sub">{panel.formula}</p>}
      </div>
    );
  }

  if (uiMode === 'alert' && panel.alerts?.length) {
    return (
      <div className="agent-response-panel alert-panel">
        <h4>Alerts ({panel.alerts.length})</h4>
        {panel.alerts.slice(0, 3).map((a, i) => (
          <div key={a.id || i} className="agent-alert-item">
            <strong>{a.title || a.alert_type}</strong>
            <span className="chip">{a.priority || a.severity}</span>
          </div>
        ))}
      </div>
    );
  }

  if (uiMode === 'comparison' && panel.comparison) {
    return (
      <div className="agent-response-panel comparison-panel">
        <h4>Comparison</h4>
        <p className="row-sub">{panel.comparison.is_number || panel.comparison.title || 'Standard comparison'}</p>
      </div>
    );
  }

  if (uiMode === 'workflow') {
    const steps = Array.isArray(panel.steps) ? panel.steps : [];
    return (
      <div className="agent-response-panel workflow-panel">
        <h4>{panel.service_name || 'Workflow'}</h4>
        {panel.status && <p><strong>Status:</strong> {panel.status}</p>}
        {panel.current_step && <p><strong>Step:</strong> {panel.current_step}</p>}
        {panel.next_action && <p className="row-sub"><strong>Next:</strong> {panel.next_action}</p>}
        {panel.record_id && <p className="row-sub">Record: {panel.record_id}</p>}
        {panel.required_documents?.length > 0 && (
          <div>
            <strong>Documents:</strong>
            {panel.required_documents.slice(0, 4).map((d, i) => (
              <p key={i} className="workflow-step">• {d}</p>
            ))}
          </div>
        )}
        {steps.slice(0, 4).map((s, i) => (
          <p key={i} className="workflow-step">{i + 1}. {s.title || s.step || s}</p>
        ))}
      </div>
    );
  }

  if (uiMode === 'knowledge' && panel.insufficient_evidence) {
    return (
      <div className="agent-response-panel warn-panel">
        <p className="warn">Insufficient indexed evidence for this answer.</p>
      </div>
    );
  }

  return null;
}

function WorkspaceColumn({ userPersona, onRunPrompt, onOpenBis, busy, send }) {
  const persona = getPersona(userPersona);
  // Single source of truth: userPersonas.js demoActions (not legacy demo-prompts.js)
  const personaPrompts = (persona.demoActions || [])
    .filter((a) => a.prompt)
    .slice(0, 6);

  return (
    <div className="agent-col agent-col-workspace">
      <ComplianceAlertBanner personaId={userPersona} />
      <PersonaWorkspace personaId={userPersona} onRunPrompt={onRunPrompt} onOpenBis={onOpenBis} />
      {personaPrompts.length > 0 && (
        <section className="agent-section agent-quick">
          <header className="agent-section-head compact"><h2>Quick prompts</h2></header>
          <div className="agent-action-chips">
            {personaPrompts.map((p) => (
              <button key={p.id} type="button" className="btn btn-sm" disabled={busy} onClick={() => send(p.prompt)} title={p.prompt}>
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ChatColumn({ messages, busy, input, setInput, send, llmConfigured, setMessages, persona }) {
  return (
    <div className="agent-col agent-col-chat">
      <section className="agent-section agent-chat-panel">
        <header className="agent-section-head compact">
          <h2>Ask MITRA</h2>
          {llmConfigured && <span className="chip chip-ok">LLM on</span>}
          {messages.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setMessages([])}>Clear</button>
          )}
        </header>
        <div className="agent-chat-log">
          {messages.length === 0 && (
            <p className="agent-empty">Ask anything about standards, fees, labs, or compliance for your role.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`agent-msg ${m.role}`}>
              <div className="agent-bubble" style={m.error ? { borderColor: 'var(--danger)' } : undefined}>
                <div className="agent-answer">{m.text}</div>
                {m.uiMode && m.uiMode !== 'chat' && (
                  <span className="chip agent-tool-chip">{m.uiMode}</span>
                )}
                {m.meta?.tool && <span className="chip chip-ok agent-tool-chip">{m.meta.tool}</span>}
                <ResponsePanel panel={m.panel} uiMode={m.uiMode} />
                <SourceList sources={m.sources} />
              </div>
            </div>
          ))}
          {busy && <div className="running">Thinking…</div>}
        </div>
        <div className="agent-chat-input">
          <input
            className="wh-filter"
            placeholder={`Ask as ${persona.short}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            disabled={busy}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !input.trim()} onClick={() => send()}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AgentChat({ clusterId, published, userPersona, layout = 'split' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(false);

  const persona = getPersona(userPersona);

  useEffect(() => {
    api.getDemoPrompts().then((d) => setLlmConfigured(!!d.llmConfigured)).catch(() => {});
  }, []);

  useEffect(() => {
    setMessages([]);
  }, [userPersona]);

  const send = async (text) => {
    const message = (text || input).trim();
    if (!message || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role,
          text: m.text,
          uiMode: m.uiMode,
          workflow: m.workflow,
          router: m.router,
        }));
      const res = await api.agentChat(message, clusterId, {
        personaMode: persona.agentMode,
        userPersona,
        sessionId: api.getSessionId(),
        userId: userPersona,
        history,
      });
      setMessages(m => [...m, {
        role: 'assistant',
        text: res.answer,
        sources: res.sources,
        uiMode: res.uiMode || res.router?.uiMode || 'knowledge',
        panel: res.panel,
        workflow: res.workflow,
        router: res.router,
        meta: {
          tool: res.probe?.tool || null,
          intent: res.router?.intent || res.intent,
          retrieval: res.retrieval?.type,
          unreadCount: res.unreadCount,
        },
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const openBis = (path) => {
    window.open(`${BIS_URL}${path}`, '_blank', 'noopener');
  };

  const workspace = (
    <WorkspaceColumn
      userPersona={userPersona}
      onRunPrompt={send}
      onOpenBis={openBis}
      busy={busy}
      send={send}
    />
  );

  const chat = (
    <ChatColumn
      messages={messages}
      busy={busy}
      input={input}
      setInput={setInput}
      send={send}
      llmConfigured={llmConfigured}
      setMessages={setMessages}
      persona={persona}
    />
  );

  if (layout === 'workspace') return <div className="agent-dashboard">{workspace}</div>;
  if (layout === 'chat') return <div className="agent-dashboard">{chat}</div>;

  return (
    <div className="agent-dashboard agent-dashboard-split">
      {workspace}
      {chat}
    </div>
  );
}
