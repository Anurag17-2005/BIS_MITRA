import { createAlert, getApplicationOwner, registerApplicationOwner } from './alert-store.js';
import { getContext, updateContext } from '../context/context-store.js';
import { sendWhatsApp } from './whatsapp.js';

function watchRecord(sessionId, referenceId, { userId, persona } = {}) {
  if (!sessionId || !referenceId) return;
  const ctx = getContext(sessionId) || {};
  updateContext(sessionId, {
    activeRecordId: referenceId,
    watchedRecords: [...new Set([...(ctx.watchedRecords || []), referenceId])],
  }, { userId, persona });
}

export async function notifyApplicationSubmitted({
  referenceId,
  status = 'Under Review',
  sessionId,
  userId,
  persona,
  product,
} = {}) {
  if (!referenceId) return { alerts: [] };
  registerApplicationOwner({ referenceId, sessionId, userId, persona });
  watchRecord(sessionId, referenceId, { userId, persona });
  const alert = createAlert({
    sessionId,
    userId,
    type: 'application_submitted',
    title: `Application submitted — ${referenceId}`,
    message: `${referenceId} (${product || 'product'}) was submitted and is ${status}.`,
    priority: 'normal',
    relatedRecordId: referenceId,
    relatedServiceId: 'SVC-CERT-001',
    source: 'mitra_submit',
    evidence: { new_status: status, record_id: referenceId },
  });
  sendWhatsApp(
    `BIS MITRA: Application ${referenceId} submitted. Status: ${status}${product ? ` · ${product}` : ''}.`,
  ).catch((err) => console.warn('[whatsapp]', err.message));
  return { alerts: [alert], whatsapp: { queued: true } };
}

export async function notifyApplicationStatusChange({
  referenceId,
  status,
  previousStatus,
  sessionId,
  userId,
  persona,
  product,
  changedBy,
  changedAt,
  recordType,
} = {}) {
  if (!referenceId || !status || previousStatus === status) {
    return { alerts: [], skipped: true };
  }
  const owner = getApplicationOwner(referenceId) || {};
  const sid = sessionId || owner.session_id;
  const uid = userId || owner.user_id;
  const who = persona || owner.persona;
  if (sid) {
    registerApplicationOwner({ referenceId, sessionId: sid, userId: uid, persona: who });
    watchRecord(sid, referenceId, { userId: uid, persona: who });
  }
  const isComplaint = recordType === 'complaint' || /^CMP-DEMO-/i.test(referenceId);
  const alert = createAlert({
    sessionId: sid || 'unassigned',
    userId: uid,
    type: isComplaint ? 'complaint_status_changed' : 'application_status_changed',
    title: isComplaint
      ? `Complaint status updated — ${referenceId}`
      : status === 'Certified'
        ? `Certification Approved — ${referenceId}`
        : `Application status changed — ${referenceId}`,
    message: isComplaint
      ? `Your complaint ${referenceId} is now **${String(status).replace(/_/g, ' ')}**.`
      : status === 'Certified'
        ? `Your certification application ${referenceId} has been certified.`
        : `${referenceId} status changed from ${previousStatus || 'previous'} to ${status}.`,
    priority: 'high',
    relatedRecordId: referenceId,
    relatedServiceId: 'SVC-CERT-001',
    source: 'ebis_applications',
    evidence: {
      previous_status: previousStatus,
      new_status: status,
      record_id: referenceId,
      product,
      changed_by: changedBy || 'BIS Certification Officer',
      changed_at: changedAt || new Date().toISOString(),
    },
  });
  sendWhatsApp(
    `BIS MITRA: Your application ${referenceId} status is now ${status}${previousStatus ? ` (was ${previousStatus})` : ''}.`,
  ).catch((err) => console.warn('[whatsapp]', err.message));
  return { alerts: [alert], whatsapp: { queued: true } };
}
