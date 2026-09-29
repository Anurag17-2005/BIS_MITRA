import MitraResponsePanel from './MitraResponsePanel';
import MitraSourceList from './MitraSourceList';
import MitraInputBar from './MitraInputBar';
import { modeLabel } from './modeLabels';

export default function MitraAgentView({
  messages,
  busy,
  input,
  setInput,
  send,
  clear,
  persona,
  onOpenSource,
  suggestedFollowUps,
}) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="mitra-agent-view">
      <header className="mitra-conv-header">
        <h2>Conversation</h2>
        {messages.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={clear}>Clear</button>
        )}
      </header>

      <div className="mitra-chat-log">
        {messages.length === 0 && (
          <div className="mitra-empty">
            <span className="mitra-empty-icon">🤖</span>
            <p>Ask anything about standards, certification, complaints, or verification.</p>
            {suggestedFollowUps?.length > 0 && (
              <div className="mitra-suggest-chips">
                {suggestedFollowUps.slice(0, 4).map((p) => (
                  <button key={p.id} type="button" className="mitra-chip-btn" onClick={() => send(p.prompt)}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`mitra-msg mitra-msg-${m.role}`}>
            {m.role === 'assistant' && <span className="mitra-avatar">M</span>}
            <div className={`mitra-bubble ${m.error ? 'mitra-bubble-error' : ''}`}>
              {m.role === 'assistant' && m.uiMode && m.uiMode !== 'chat' && (
                <span className="mitra-mode-pill">{modeLabel(m.uiMode, m.intent)}</span>
              )}
              <div className="mitra-answer">{m.text}</div>
              {m.role === 'assistant' && (
                <>
                  <MitraResponsePanel panel={m.panel} uiMode={m.uiMode} />
                  <MitraSourceList sources={m.sources} onOpenSource={onOpenSource} />
                </>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="mitra-thinking">MITRA is thinking…</div>}
      </div>

      <MitraInputBar
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        busy={busy}
        placeholder={`Ask as ${persona.short}…`}
        lastUiMode={lastAssistant?.uiMode}
        lastIntent={lastAssistant?.intent}
      />
    </div>
  );
}
