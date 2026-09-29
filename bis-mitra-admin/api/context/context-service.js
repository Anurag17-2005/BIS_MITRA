import {
  getContext,
  updateContext,
  getRecentConversation,
  appendConversationTurn,
  updateConversationSummary,
} from './context-store.js';
import { extractContextFromHistory, resolveQueryWithContext } from '../agent/router/context.js';

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

/**
 * Merge persisted session context with ephemeral history extraction.
 */
export function loadSessionContext(sessionId, { userId, persona, history = [] } = {}) {
  const stored = sessionId ? (getContext(sessionId) || {}) : {};
  const fromHistory = extractContextFromHistory(history);

  const identifiedEntities = {
    isNumbers: uniq([...(stored.identifiedEntities?.isNumbers || []), ...fromHistory.isNumbers]),
    qcoIds: uniq([...(stored.identifiedEntities?.qcoIds || []), ...fromHistory.qcoIds]),
    cmlIds: uniq([...(stored.identifiedEntities?.cmlIds || []), ...fromHistory.cmlIds]),
    huidCodes: uniq([...(stored.identifiedEntities?.huidCodes || []), ...fromHistory.huidCodes]),
    labIds: uniq([...(stored.identifiedEntities?.labIds || []), ...fromHistory.labIds]),
    caseIds: uniq([...(stored.identifiedEntities?.caseIds || []), ...fromHistory.caseIds]),
    appIds: uniq([...(stored.identifiedEntities?.appIds || []), ...fromHistory.appIds]),
  };

  const activeRecordId = stored.activeRecordId
    || fromHistory.lastRecordId
    || identifiedEntities.appIds.slice(-1)[0]
    || identifiedEntities.caseIds.slice(-1)[0]
    || null;

  return {
    sessionId,
    userId: stored.userId || userId || null,
    persona: stored.persona || persona || null,
    activeService: stored.activeService || fromHistory.lastServiceId || null,
    activeWorkflow: stored.activeWorkflow || fromHistory.workflowIds?.slice(-1)[0] || null,
    activeRecordId,
    identifiedEntities,
    currentIntent: stored.currentIntent || fromHistory.lastIntent || null,
    currentTask: stored.currentTask || null,
    userInfo: stored.userInfo || {},
    watchedRecords: uniq([...(stored.watchedRecords || []), activeRecordId]),
    lastProduct: fromHistory.lastProduct || stored.lastProduct || null,
    updatedAt: stored.updatedAt || null,
  };
}

/**
 * Resolve query using both chat history and persisted session context.
 */
export function resolveQueryWithSessionContext(query, history = [], sessionContext = null) {
  const enrichedHistory = [...history];
  if (sessionContext?.activeService || sessionContext?.activeRecordId) {
    enrichedHistory.push({
      role: 'system',
      text: '',
      workflow: {
        service_id: sessionContext.activeService,
        record_id: sessionContext.activeRecordId,
        workflow_id: sessionContext.activeWorkflow,
      },
      router: {
        serviceId: sessionContext.activeService,
        intent: sessionContext.currentIntent,
      },
    });
  }

  const base = resolveQueryWithContext(query, enrichedHistory);
  const wc = { ...base.workflowContext };

  if (sessionContext) {
    if (!wc.serviceId && sessionContext.activeService) wc.serviceId = sessionContext.activeService;
    if (!wc.recordId && sessionContext.activeRecordId) wc.recordId = sessionContext.activeRecordId;
    if (!wc.workflowId && sessionContext.activeWorkflow) wc.workflowId = sessionContext.activeWorkflow;
    if (!wc.product && sessionContext.lastProduct) wc.product = sessionContext.lastProduct;
    if (!wc.isNumber && sessionContext.identifiedEntities?.isNumbers?.length) {
      wc.isNumber = sessionContext.identifiedEntities.isNumbers.slice(-1)[0];
    }
  }

  return {
    ...base,
    workflowContext: wc,
    sessionContext,
  };
}

export function deriveContextUpdates(sessionContext, { router, message, result } = {}) {
  const patch = {
    currentIntent: router?.intent || sessionContext?.currentIntent,
    identifiedEntities: { ...(sessionContext?.identifiedEntities || {}) },
  };

  const ids = router?.identifiers || router?.entities || {};
  for (const [key, src] of [
    ['isNumbers', ids.isNumbers],
    ['qcoIds', ids.qcoIds],
    ['cmlIds', ids.cmlIds],
    ['huidCodes', ids.huidCodes],
    ['labIds', ids.labIds],
    ['caseIds', ids.caseIds],
    ['appIds', ids.appIds],
  ]) {
    if (src?.length) {
      patch.identifiedEntities[key] = uniq([
        ...(patch.identifiedEntities[key] || []),
        ...src,
      ]);
    }
  }

  const wc = router?.workflowContext || {};
  if (wc.serviceId) patch.activeService = wc.serviceId;
  if (wc.workflowId) patch.activeWorkflow = wc.workflowId;
  if (wc.recordId) patch.activeRecordId = wc.recordId;
  if (wc.product) patch.lastProduct = wc.product;

  const wf = result?.workflow;
  if (wf?.service_id) patch.activeService = wf.service_id;
  if (wf?.workflow_id) patch.activeWorkflow = wf.workflow_id;
  if (wf?.record_id || wf?.application_id) {
    patch.activeRecordId = wf.record_id || wf.application_id;
  }

  if (sessionContext?.currentTask === 'certification_collect' && result?.uiMode !== 'status') {
    patch.currentTask = 'certification_collect';
  } else if (result?.uiMode === 'status' || result?.panel?.status === 'Submitted') {
    patch.currentTask = null;
  } else if (/\b(certif|licen[cs]e|complaint|lab\s+recognition|apply)\b/i.test(message || '')) {
    if (router?.intent === 'task') patch.currentTask = 'service_discovery';
    if (router?.intent === 'workflow_status') patch.currentTask = 'status_tracking';
  }

  const watched = uniq([
    ...(sessionContext?.watchedRecords || []),
    patch.activeRecordId,
    wf?.record_id,
    wf?.application_id,
  ]);
  if (watched.length) patch.watchedRecords = watched;

  return patch;
}

export function persistChatTurn(sessionId, { userMessage, assistantResult, router, userId, persona }) {
  if (!sessionId) return null;

  const prior = getRecentConversation(sessionId, 8);
  const history = prior.length
    ? prior
    : [];

  const sessionContext = loadSessionContext(sessionId, { userId, persona, history });

  appendConversationTurn(sessionId, {
    role: 'user',
    text: userMessage,
    metadata: { intent: router?.intent },
  });

  appendConversationTurn(sessionId, {
    role: 'assistant',
    text: assistantResult?.answer || '',
    metadata: {
      intent: router?.intent,
      tool: assistantResult?.probe?.tool,
      uiMode: assistantResult?.uiMode,
      workflow: assistantResult?.workflow ? {
        service_id: assistantResult.workflow.service_id,
        record_id: assistantResult.workflow.record_id || assistantResult.workflow.application_id,
        workflow_id: assistantResult.workflow.workflow_id,
        status: assistantResult.workflow.current_status || assistantResult.workflow.status,
      } : null,
      router: assistantResult?.router || null,
    },
  });

  const patch = deriveContextUpdates(sessionContext, {
    router: { ...router, identifiers: router?.entities },
    message: userMessage,
    result: assistantResult,
  });

  return updateContext(sessionId, patch, { userId, persona });
}

export {
  getContext,
  updateContext,
  clearContext,
  getRecentConversation,
  appendConversationTurn,
  updateConversationSummary,
} from './context-store.js';
