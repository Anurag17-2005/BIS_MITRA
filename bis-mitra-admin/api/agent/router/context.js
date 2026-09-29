import { extractIdentifiers } from '../../retrieval/identifiers.js';

const PRONOUN_RE = /\b(it|this|that|them|the\s+standard|the\s+qco|the\s+licen[cs]e)\b/i;

/**
 * Extract entities from conversation history for follow-up resolution.
 */
export function extractContextFromHistory(history = []) {
  const ctx = {
    isNumbers: [],
    qcoIds: [],
    cmlIds: [],
    huidCodes: [],
    labIds: [],
    caseIds: [],
    appIds: [],
    workflowIds: [],
    lastIntent: null,
    lastTopic: null,
    lastServiceId: null,
    lastRecordId: null,
    lastProduct: null,
  };

  for (const msg of history.slice(-6)) {
    const text = msg?.text || msg?.content || '';
    if (!text) continue;
    const ids = extractIdentifiers(text);
    if (ids.isNumbers.length) ctx.isNumbers = [...new Set([...ctx.isNumbers, ...ids.isNumbers])];
    if (ids.qcoIds.length) ctx.qcoIds = [...new Set([...ctx.qcoIds, ...ids.qcoIds])];
    if (ids.cmlIds.length) ctx.cmlIds = [...new Set([...ctx.cmlIds, ...ids.cmlIds])];
    if (ids.huidCodes.length) ctx.huidCodes = [...new Set([...ctx.huidCodes, ...ids.huidCodes])];
    if (ids.labIds.length) ctx.labIds = [...new Set([...ctx.labIds, ...ids.labIds])];
    if (ids.caseIds.length) ctx.caseIds = [...new Set([...ctx.caseIds, ...ids.caseIds])];
    if (ids.appIds?.length) ctx.appIds = [...new Set([...ctx.appIds, ...ids.appIds])];
    if (msg.workflow?.workflow_id) ctx.workflowIds.push(msg.workflow.workflow_id);
    if (msg.workflow?.service_id) ctx.lastServiceId = msg.workflow.service_id;
    if (msg.workflow?.record_id) ctx.lastRecordId = msg.workflow.record_id;
    if (msg.router?.serviceId) ctx.lastServiceId = msg.router.serviceId;
    if (msg.router?.intent) ctx.lastIntent = msg.router.intent;
    if (ids.isNumbers[0]) ctx.lastTopic = ids.isNumbers[0];
    if (/\b(helmet|geyser|induction|gold|mortar)\b/i.test(text)) {
      const m = text.match(/\b(helmet|geyser|induction cook\w*|gold|mortar)\b/i);
      if (m) ctx.lastProduct = m[0];
    }
  }

  return ctx;
}

/**
 * Resolve pronouns in follow-up queries using prior context.
 */
export function resolveQueryWithContext(query, history = []) {
  const contextEntities = extractContextFromHistory(history);
  let resolved = String(query || '').trim();
  const ids = extractIdentifiers(resolved);

  const strongId = ids.isNumbers.length || ids.huidCodes.length || ids.cmlIds.length
    || ids.caseIds.length || ids.appIds.length;

  if (PRONOUN_RE.test(resolved) && !strongId) {
    if (contextEntities.isNumbers.length && /\b(it|this|that|the\s+standard)\b/i.test(resolved)) {
      const isn = contextEntities.isNumbers[contextEntities.isNumbers.length - 1];
      resolved = `${resolved} ${isn}`;
      ids.isNumbers.push(isn);
    }
    if (contextEntities.qcoIds.length && /\b(it|this|that|the\s+qco)\b/i.test(resolved)) {
      const qco = contextEntities.qcoIds[contextEntities.qcoIds.length - 1];
      resolved = `${resolved} ${qco}`;
      ids.qcoIds.push(qco);
    }
    if (contextEntities.cmlIds.length && /\b(it|this|that|the\s+licen[cs]e)\b/i.test(resolved)) {
      const cml = contextEntities.cmlIds[contextEntities.cmlIds.length - 1];
      resolved = `${resolved} ${cml}`;
      ids.cmlIds.push(cml);
    }
  }

  const workflowContext = {
    serviceId: contextEntities.lastServiceId,
    recordId: contextEntities.lastRecordId || contextEntities.appIds?.slice(-1)[0] || contextEntities.caseIds?.slice(-1)[0],
    workflowId: contextEntities.workflowIds?.slice(-1)[0],
    isNumber: contextEntities.isNumbers?.slice(-1)[0],
    product: contextEntities.lastProduct,
  };

  // Follow-up: documents / next step without explicit ID
  if (!extractIdentifiers(resolved).appIds?.length && !extractIdentifiers(resolved).caseIds?.length) {
    if (/\b(documents?|next\s+step|what\s+happens|requirements?)\b/i.test(resolved) && workflowContext.serviceId) {
      if (workflowContext.isNumber && !resolved.includes(workflowContext.isNumber)) {
        resolved = `${resolved} ${workflowContext.isNumber}`;
      }
      if (workflowContext.product && !resolved.toLowerCase().includes(workflowContext.product.toLowerCase())) {
        resolved = `${resolved} ${workflowContext.product}`;
      }
    }
  }

  return {
    query: resolved.replace(/\s+/g, ' ').trim(),
    originalQuery: query,
    contextEntities,
    workflowContext,
    identifiers: extractIdentifiers(resolved),
    isFollowUp: resolved !== String(query || '').trim(),
  };
}
