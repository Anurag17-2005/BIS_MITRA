import { modeLabel } from './modeLabels';

export default function MitraInputBar({
  value,
  onChange,
  onSend,
  busy,
  placeholder = 'Ask BIS MITRA…',
  modeHint,
  lastUiMode,
  lastIntent,
}) {
  const indicator = modeHint || modeLabel(lastUiMode, lastIntent);

  return (
    <div className="mitra-input-wrap">
      <div className="mitra-input-bar">
        <button type="button" className="mitra-input-icon" title="Attach" disabled>📎</button>
        <input
          className="mitra-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          disabled={busy}
        />
        <button type="button" className="mitra-input-icon" title="Voice" disabled>🎤</button>
        <button
          type="button"
          className="mitra-send-btn"
          disabled={busy || !value.trim()}
          onClick={() => onSend()}
          aria-label="Send"
        >
          ➤
        </button>
      </div>
      {indicator && (
        <div className="mitra-mode-indicator" title="Detected mode (automatic)">
          {indicator}
        </div>
      )}
    </div>
  );
}
