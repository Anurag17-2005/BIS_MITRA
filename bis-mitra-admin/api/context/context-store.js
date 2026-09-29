import { getSessionDb } from '../agent/session-db.js';

const DEFAULT_CONTEXT = () => ({
  activeService: null,
  activeWorkflow: null,
  activeRecordId: null,
  identifiedEntities: {
    isNumbers: [],
    qcoIds: [],
    cmlIds: [],
    huidCodes: [],
    labIds: [],
    caseIds: [],
    appIds: [],
  },
  currentIntent: null,
  currentTask: null,
  userInfo: {},
  watchedRecords: [],
});

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getContext(sessionId) {
  if (!sessionId) return null;
  const row = getSessionDb().prepare(
    'SELECT session_id, user_id, persona, context_json, updated_at FROM session_context WHERE session_id = ?'
  ).get(sessionId);
  if (!row) return null;
  const ctx = parseJson(row.context_json, DEFAULT_CONTEXT());
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    persona: row.persona,
    ...ctx,
    updatedAt: row.updated_at,
  };
}

export function updateContext(sessionId, patch = {}, { userId, persona } = {}) {
  if (!sessionId) throw new Error('sessionId required');
  const existing = getContext(sessionId) || {
    sessionId,
    userId: userId || null,
    persona: persona || null,
    ...DEFAULT_CONTEXT(),
  };

  const merged = {
    ...existing,
    ...patch,
    identifiedEntities: {
      ...DEFAULT_CONTEXT().identifiedEntities,
      ...(existing.identifiedEntities || {}),
      ...(patch.identifiedEntities || {}),
    },
    userInfo: {
      ...(existing.userInfo || {}),
      ...(patch.userInfo || {}),
    },
    watchedRecords: patch.watchedRecords
      ? [...new Set(patch.watchedRecords)]
      : existing.watchedRecords || [],
  };

  delete merged.sessionId;
  delete merged.userId;
  delete merged.persona;
  delete merged.updatedAt;

  getSessionDb().prepare(`
    INSERT INTO session_context (session_id, user_id, persona, context_json, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, session_context.user_id),
      persona = COALESCE(excluded.persona, session_context.persona),
      context_json = excluded.context_json,
      updated_at = datetime('now')
  `).run(
    sessionId,
    userId || existing.userId || null,
    persona || existing.persona || null,
    JSON.stringify(merged),
  );

  return getContext(sessionId);
}

export function clearContext(sessionId) {
  if (!sessionId) return { ok: true };
  const db = getSessionDb();
  db.prepare('DELETE FROM conversation_turns WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM conversation_summaries WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM record_snapshots WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM user_alerts WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_context WHERE session_id = ?').run(sessionId);
  return { ok: true, sessionId };
}

export function getRecentConversation(sessionId, limit = 8) {
  if (!sessionId) return [];
  return getSessionDb().prepare(`
    SELECT role, text, metadata_json, created_at
    FROM conversation_turns
    WHERE session_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(sessionId, limit).reverse().map(row => ({
    role: row.role,
    text: row.text,
    ...(parseJson(row.metadata_json, null) || {}),
    createdAt: row.created_at,
  }));
}

export function appendConversationTurn(sessionId, { role, text, metadata = null }) {
  if (!sessionId || !role || !text) return;
  getSessionDb().prepare(`
    INSERT INTO conversation_turns (session_id, role, text, metadata_json)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, role, text, metadata ? JSON.stringify(metadata) : null);
}

export function updateConversationSummary(sessionId, summary) {
  if (!sessionId) return null;
  getSessionDb().prepare(`
    INSERT INTO conversation_summaries (session_id, summary, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET
      summary = excluded.summary,
      updated_at = datetime('now')
  `).run(sessionId, summary || '');
  return { sessionId, summary };
}

export function getConversationSummary(sessionId) {
  if (!sessionId) return null;
  const row = getSessionDb().prepare(
    'SELECT summary, updated_at FROM conversation_summaries WHERE session_id = ?'
  ).get(sessionId);
  return row ? { summary: row.summary, updatedAt: row.updated_at } : null;
}

export function getRecordSnapshot(sessionId, recordId) {
  const row = getSessionDb().prepare(
    'SELECT snapshot_json, updated_at FROM record_snapshots WHERE session_id = ? AND record_id = ?'
  ).get(sessionId, recordId);
  return row ? { ...parseJson(row.snapshot_json, {}), updatedAt: row.updated_at } : null;
}

export function setRecordSnapshot(sessionId, recordId, snapshot) {
  getSessionDb().prepare(`
    INSERT INTO record_snapshots (session_id, record_id, snapshot_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(session_id, record_id) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = datetime('now')
  `).run(sessionId, recordId, JSON.stringify(snapshot || {}));
}
