import { getWorkflowStatus } from '../workflows/common/workflow-bridge.js';
import { executeProbeApi } from '../core/probes.js';
import { getSessionDb } from '../agent/session-db.js';
import { getContext, getRecordSnapshot, setRecordSnapshot } from '../context/context-store.js';
import { createAlert, listAlerts } from './alert-store.js';

const ALERT_PRIORITY = {
  application_status_changed: 'high',
  action_required: 'high',
  document_required: 'high',
  inspection_scheduled: 'normal',
  complaint_status_changed: 'high',
  licence_expiry_approaching: 'high',
  workflow_completed: 'normal',
  workflow_rejected: 'critical',
};

const ACTION_REQUIRED_STATUSES = new Set([
  'Query Raised',
  'Documents Required',
  'QUERY_RAISED',
  'DOCUMENTS_REQUIRED',
]);

const INSPECTION_STATUSES = new Set([
  'Inspection Scheduled',
  'INSPECTION_SCHEDULED',
  'Inspection/Testing',
]);

const TERMINAL_STATUSES = new Set([
  'Granted',
  'Resolved',
  'Closed',
  'Active',
  'Recognised',
  'REJECTED',
  'Rejected',
]);

let scannerTimer = null;

async function fetchRecordState(recordId) {
  if (!recordId) return null;

  try {
    const wf = await getWorkflowStatus(recordId, {});
    if (wf?.ok !== false && (wf?.current_status || wf?.status || wf?.record_id)) {
      return {
        recordId: wf.record_id || wf.application_id || recordId,
        status: wf.current_status || wf.status,
        nextAction: wf.next_action,
        serviceId: wf.service_id,
        workflowId: wf.workflow_id,
        source: 'ebis_workflow',
        raw: wf,
      };
    }
  } catch { /* fall through */ }

  if (/^CML|LIC-/i.test(recordId)) {
    try {
      const lic = await executeProbeApi('licence_search', recordId);
      const row = lic?.results?.[0] || lic?.licences?.[0] || lic;
      if (row) {
        return {
          recordId,
          status: row.status || row.licence_status,
          expiry: row.valid_to || row.validity_to,
          serviceId: 'SVC-LIC-001',
          source: 'licence_registry',
          raw: row,
        };
      }
    } catch { /* ignore */ }
  }

  if (/^BIS-APP|^ISI-/i.test(recordId)) {
    try {
      const app = await executeProbeApi('application_search', recordId);
      const row = app?.results?.[0] || app?.applications?.[0];
      if (row) {
        return {
          recordId: row.reference_id || row.application_id || recordId,
          status: row.status,
          serviceId: 'SVC-CERT-001',
          source: 'application_registry',
          raw: row,
        };
      }
    } catch { /* ignore */ }
  }

  return null;
}

function classifyAlertType(prev, next) {
  const oldStatus = prev?.status;
  const newStatus = next?.status;
  if (!oldStatus || !newStatus || oldStatus === newStatus) return null;

  if (TERMINAL_STATUSES.has(newStatus) && /reject/i.test(newStatus)) {
    return 'workflow_rejected';
  }
  if (TERMINAL_STATUSES.has(newStatus) && /grant|resolved|closed|active|recognised/i.test(newStatus)) {
    return 'workflow_completed';
  }
  if (ACTION_REQUIRED_STATUSES.has(newStatus) || /query|document/i.test(newStatus)) {
    return /document/i.test(newStatus) ? 'document_required' : 'action_required';
  }
  if (INSPECTION_STATUSES.has(newStatus) || /inspection/i.test(newStatus)) {
    return 'inspection_scheduled';
  }
  if (/^CMP|^CON-GRP/i.test(next.recordId)) {
    return 'complaint_status_changed';
  }
  if (next.expiry && prev?.expiry !== next.expiry) {
    return 'licence_expiry_approaching';
  }
  return 'application_status_changed';
}

function buildAlertMessage(type, next, prev) {
  const record = next.recordId;
  const status = next.status;
  switch (type) {
    case 'document_required':
      return `${record} requires additional documents. ${next.nextAction || 'Upload via eBIS portal.'}`;
    case 'action_required':
      return `${record} needs your action. Status: ${status}. ${next.nextAction || ''}`.trim();
    case 'inspection_scheduled':
      return `Inspection scheduled for ${record}. ${next.nextAction || 'Retain samples for officer visit.'}`;
    case 'complaint_status_changed':
      return `Complaint ${record} updated to ${status}.`;
    case 'licence_expiry_approaching':
      return `Licence ${record} validity ending soon (${next.expiry}). Plan renewal.`;
    case 'workflow_completed':
      return `${record} reached ${status}. Review next steps in eBIS.`;
    case 'workflow_rejected':
      return `${record} was rejected (${status}). Review officer remarks.`;
    default:
      return `${record} status changed from ${prev?.status || 'unknown'} to ${status}.`;
  }
}

/**
 * Compare current BIS/eBIS record state with last snapshot; emit alerts on meaningful change.
 */
export async function scanRecordForAlerts(sessionId, recordId, { userId } = {}) {
  if (!sessionId || !recordId) return [];

  const current = await fetchRecordState(recordId);
  if (!current?.status) return [];

  const snapshot = getRecordSnapshot(sessionId, recordId);
  const created = [];

  if (!snapshot?.status) {
    setRecordSnapshot(sessionId, recordId, {
      status: current.status,
      nextAction: current.nextAction,
      expiry: current.expiry,
      serviceId: current.serviceId,
      workflowId: current.workflowId,
    });
    return [];
  }

  if (snapshot.status === current.status
    && snapshot.nextAction === current.nextAction
    && snapshot.expiry === current.expiry) {
    return [];
  }

  const type = classifyAlertType(snapshot, current);
  if (!type) {
    setRecordSnapshot(sessionId, recordId, {
      status: current.status,
      nextAction: current.nextAction,
      expiry: current.expiry,
      serviceId: current.serviceId,
      workflowId: current.workflowId,
    });
    return [];
  }

  const existing = listAlerts({ sessionId, limit: 20 }).find(a =>
    a.type === type
    && a.related_record_id === current.recordId
    && a.evidence?.new_status === current.status
  );
  if (existing) return [];

  const alert = createAlert({
    sessionId,
    userId,
    type,
    title: buildAlertTitle(type, current),
    message: buildAlertMessage(type, current, snapshot),
    priority: ALERT_PRIORITY[type] || 'normal',
    relatedRecordId: current.recordId,
    relatedServiceId: current.serviceId,
    relatedWorkflowId: current.workflowId,
    source: current.source,
    evidence: {
      previous_status: snapshot.status,
      new_status: current.status,
      next_action: current.nextAction,
      record_id: current.recordId,
    },
  });
  created.push(alert);

  setRecordSnapshot(sessionId, recordId, {
    status: current.status,
    nextAction: current.nextAction,
    expiry: current.expiry,
    serviceId: current.serviceId,
    workflowId: current.workflowId,
  });

  return created;
}

function buildAlertTitle(type, current) {
  const labels = {
    application_status_changed: 'Application status changed',
    action_required: 'Action required on your application',
    document_required: 'Documents required',
    inspection_scheduled: 'Inspection scheduled',
    complaint_status_changed: 'Complaint status updated',
    licence_expiry_approaching: 'Licence expiry approaching',
    workflow_completed: 'Workflow completed',
    workflow_rejected: 'Application rejected',
  };
  return `${labels[type] || 'Status update'} — ${current.recordId}`;
}

export async function scanSessionAlerts(sessionId, { userId } = {}) {
  const ctx = getContext(sessionId);
  if (!ctx) return [];

  const records = [...new Set([
    ...(ctx.watchedRecords || []),
    ctx.activeRecordId,
  ].filter(Boolean))];

  const all = [];
  for (const recordId of records) {
    const alerts = await scanRecordForAlerts(sessionId, recordId, { userId: userId || ctx.userId });
    all.push(...alerts);
  }
  return all;
}

export function startAlertScanner({ intervalMs = 20000 } = {}) {
  if (scannerTimer) return;
  scannerTimer = setInterval(async () => {
    try {
      const rows = getSessionDb().prepare(
        'SELECT session_id, user_id FROM session_context WHERE json_extract(context_json, \'$.watchedRecords\') IS NOT NULL'
      ).all();
      for (const row of rows) {
        await scanSessionAlerts(row.session_id, { userId: row.user_id });
      }
    } catch {
      /* scanner is best-effort */
    }
  }, intervalMs);
  if (scannerTimer.unref) scannerTimer.unref();
}

export function stopAlertScanner() {
  if (scannerTimer) {
    clearInterval(scannerTimer);
    scannerTimer = null;
  }
}
