import { randomUUID } from 'crypto';
import { getSessionDb } from '../agent/session-db.js';

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowToAlert(row) {
  return {
    alert_id: row.alert_id,
    id: row.alert_id,
    session_id: row.session_id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    related_record_id: row.related_record_id,
    related_service_id: row.related_service_id,
    related_workflow_id: row.related_workflow_id,
    related_workflow: row.related_workflow_id,
    related_service: row.related_service_id,
    source: row.source,
    evidence: parseJson(row.evidence_json),
    status: row.status,
    read: row.read_flag === 1,
    unread: row.read_flag !== 1,
    created_at: row.created_at,
  };
}

export function createAlert({
  sessionId,
  userId = null,
  type,
  title,
  message,
  priority = 'normal',
  relatedRecordId = null,
  relatedServiceId = null,
  relatedWorkflowId = null,
  source = 'bis_record',
  evidence = null,
  status = 'active',
}) {
  const alertId = `ALT-${randomUUID().slice(0, 8).toUpperCase()}`;
  getSessionDb().prepare(`
    INSERT INTO user_alerts (
      alert_id, session_id, user_id, type, title, message, priority,
      related_record_id, related_service_id, related_workflow_id,
      source, evidence_json, status, read_flag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    alertId,
    sessionId,
    userId,
    type,
    title,
    message || '',
    priority,
    relatedRecordId,
    relatedServiceId,
    relatedWorkflowId,
    source,
    evidence ? JSON.stringify(evidence) : null,
    status,
  );
  return getAlert(alertId);
}

export function getAlert(alertId) {
  const row = getSessionDb().prepare('SELECT * FROM user_alerts WHERE alert_id = ?').get(alertId);
  return row ? rowToAlert(row) : null;
}

export function listAlerts({ sessionId, userId, unreadOnly = false, limit = 50 } = {}) {
  let sql = 'SELECT * FROM user_alerts WHERE status = ?';
  const params = ['active'];
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  if (userId) {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(userId);
  }
  if (unreadOnly) sql += ' AND read_flag = 0';
  sql += ' ORDER BY created_at DESC, alert_id DESC LIMIT ?';
  params.push(limit);
  return getSessionDb().prepare(sql).all(...params).map(rowToAlert);
}

export function getUnreadCount({ sessionId, userId } = {}) {
  let sql = 'SELECT COUNT(*) as n FROM user_alerts WHERE status = ? AND read_flag = 0';
  const params = ['active'];
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  if (userId) {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(userId);
  }
  return getSessionDb().prepare(sql).get(...params)?.n || 0;
}

export function markAlertRead(alertId, { sessionId } = {}) {
  let sql = 'UPDATE user_alerts SET read_flag = 1 WHERE alert_id = ?';
  const params = [alertId];
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  const info = getSessionDb().prepare(sql).run(...params);
  return { ok: info.changes > 0, alert: getAlert(alertId) };
}

export function dismissAlert(alertId) {
  getSessionDb().prepare(
    'UPDATE user_alerts SET status = ?, read_flag = 1 WHERE alert_id = ?'
  ).run('dismissed', alertId);
  return getAlert(alertId);
}

export function registerApplicationOwner({ referenceId, sessionId, userId, persona }) {
  if (!referenceId) return null;
  getSessionDb().prepare(`
    INSERT INTO application_owners (reference_id, session_id, user_id, persona)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(reference_id) DO UPDATE SET
      session_id = COALESCE(excluded.session_id, application_owners.session_id),
      user_id = COALESCE(excluded.user_id, application_owners.user_id),
      persona = COALESCE(excluded.persona, application_owners.persona)
  `).run(referenceId, sessionId || null, userId || null, persona || null);
  return getApplicationOwner(referenceId);
}

export function getApplicationOwner(referenceId) {
  if (!referenceId) return null;
  return getSessionDb().prepare(
    'SELECT * FROM application_owners WHERE reference_id = ?'
  ).get(referenceId) || null;
}

export function listApplicationOwners({ sessionId, userId } = {}) {
  let sql = 'SELECT * FROM application_owners WHERE 1=1';
  const params = [];
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  if (userId) {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(userId);
  }
  return getSessionDb().prepare(sql).all(...params);
}
