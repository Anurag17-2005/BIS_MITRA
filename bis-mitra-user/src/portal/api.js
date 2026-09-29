const API = import.meta.env.VITE_API_URL || '';

function storage(mode) {
  return mode === 'preview' ? sessionStorage : localStorage;
}

export function getSessionId(mode = 'user', personaId = 'industry') {
  const key = mode === 'preview'
    ? `bis_preview_session_${personaId}`
    : `bis_user_session_${personaId}`;
  const store = storage(mode);
  let id = store.getItem(key);
  if (!id) {
    id = `${mode === 'preview' ? 'preview' : 'user'}-${personaId}-${crypto.randomUUID().slice(0, 10)}`;
    store.setItem(key, id);
  }
  return id;
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export async function getPortalConfig() {
  const res = await fetch(`${API}/api/portal/config`);
  return parseJson(res);
}

export async function transcribeAudio(blob, { languageMode = 'auto', highAccuracy = false } = {}) {
  const form = new FormData();
  form.append('audio', blob, blob.name || 'recording.webm');
  form.append('languageMode', languageMode);
  if (highAccuracy) form.append('highAccuracy', 'true');
  const res = await fetch(`${API}/api/transcribe`, { method: 'POST', body: form });
  return parseJson(res);
}

export async function getTranscribeStatus() {
  const res = await fetch(`${API}/api/transcribe/status`);
  return parseJson(res);
}

export async function agentChat(message, clusterId, options = {}) {
  const res = await fetch(`${API}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      clusterId,
      personaMode: options.personaMode,
      userPersona: options.userPersona,
      sessionId: options.sessionId,
      userId: options.userId,
      liveProbe: 'auto',
      history: options.history,
      language: options.language,
      userProfile: options.userProfile,
      conversationId: options.conversationId || null,
      confirmSubmit: options.confirmSubmit || false,
      confirmFields: options.confirmFields || null,
      chatModule: options.chatModule || 'knowledge',
    }),
  });
  return parseJson(res);
}

export async function getPortalApplications(sessionId, userId, persona) {
  const q = new URLSearchParams({ sessionId, userId, persona });
  const res = await fetch(`${API}/api/portal/applications?${q}`);
  return parseJson(res);
}

export async function getUserAlerts(sessionId, userId) {
  const q = new URLSearchParams({ sessionId, userId });
  const res = await fetch(`${API}/api/agent/alerts?${q}`);
  return parseJson(res);
}

export async function getUnreadCount(sessionId, userId) {
  const q = new URLSearchParams({ sessionId, userId });
  const res = await fetch(`${API}/api/agent/alerts/unread-count?${q}`);
  return parseJson(res);
}

export async function getComplianceAlerts(persona) {
  const q = new URLSearchParams({ unacknowledged: '1', persona });
  const res = await fetch(`${API}/api/compliance/alerts?${q}`);
  return parseJson(res);
}

export function sourceToPdfUrl(source) {
  if (!source) return null;
  const file = source.storage_uri || source.source_file || source.sourceFile || source.file;
  if (!file) return null;
  const raw = String(file).replace(/\\/g, '/').replace(/^\/+/, '');
  let base;
  if (raw.startsWith('http')) base = raw.split('#')[0];
  else if (raw.startsWith('knowledge/')) base = `${API}/api/clone-files/${raw}`;
  else if (raw.includes('/')) base = `${API}/api/clone-files/knowledge/pdfs/${raw}`;
  else base = `${API}/api/clone-files/knowledge/pdfs/manuals/${raw}`;
  return base;
}
