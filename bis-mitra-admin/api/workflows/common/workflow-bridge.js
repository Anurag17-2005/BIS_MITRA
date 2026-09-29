import { fetchClone } from '../../core/clone-client.js';
import { extractIdentifiers } from '../../retrieval/identifiers.js';
import { wantsComplaintFiling } from '../../agent/router/intents.js';

const SERVICE_KEYWORDS = {
  'SVC-CERT-001': /\b(certif|licen[cs]e|apply|form-?i|isi\s+mark|manufactur)\b/i,
  'SVC-GRIEV-001': /\b(complaint|grievance|file\s+a\s+complaint|consumer\s+complaint)\b/i,
  'SVC-LAB-001': /\b(lab\s+recognition|laboratory\s+application|nabl)\b/i,
  'SVC-LIC-001': /\b(renew|validity|existing\s+licen[cs]e)\b/i,
  'SVC-HUID-001': /\b(huid|hallmark\s+verify)\b/i,
  'SVC-FMCS-001': /\b(fmcs|foreign\s+manufacturer|import\s+certif)\b/i,
};

/**
 * Extract active workflow context from conversation history.
 */
export function extractWorkflowContext(history = []) {
  const ctx = {
    serviceId: null,
    workflowId: null,
    recordId: null,
    isNumber: null,
    product: null,
    persona: null,
  };

  for (const msg of history.slice(-8).reverse()) {
    const text = msg?.text || msg?.content || '';
    const wf = msg?.workflow || msg?.rule;
    if (wf?.service_id && !ctx.serviceId) ctx.serviceId = wf.service_id;
    if (msg?.router?.serviceId && !ctx.serviceId) ctx.serviceId = msg.router.serviceId;
    if (wf?.workflow_id && !ctx.workflowId) ctx.workflowId = wf.workflow_id;
    if (msg?.router?.intent === 'task' && !ctx.serviceId) ctx.serviceId = 'SVC-CERT-001';
    if (msg?.router?.intent === 'workflow_status' && !ctx.serviceId) {
      ctx.serviceId = msg.workflow?.service_id || null;
    }

    const ids = extractIdentifiers(text);
    if (!ctx.recordId) {
      ctx.recordId = ids.appIds?.[0] || ids.caseIds?.[0] || wf?.record_id || wf?.application_id || null;
    }
    if (!ctx.isNumber && ids.isNumbers?.length) ctx.isNumber = ids.isNumbers[ids.isNumbers.length - 1];
    if (!ctx.product && /\b(helmet|geyser|induction|gold|mortar|pipe)\b/i.test(text)) {
      const m = text.match(/\b(helmet|geyser|induction cook\w*|gold|mortar|pipe)\b/i);
      if (m) ctx.product = m[0];
    }
  }

  return ctx;
}

export function pickWorkflowTool(query, router, workflowCtx = {}) {
  const q = String(query || '');
  const ids = extractIdentifiers(q);

  if (ids.appIds?.length || ids.caseIds?.length || /\b(?:CERT|CMP|LAB-APP|BIS-APP|CON-GRP|WF)-DEMO[\s-][\w-]+/i.test(q)) {
    return 'get_workflow_status';
  }
  if (/\b(status|next\s+step|track|progress|what\s+happens\s+after)\b/i.test(q) && (workflowCtx.recordId || workflowCtx.workflowId)) {
    return 'get_workflow_status';
  }
  if (/\b(what\s+documents|which\s+documents|required\s+documents|documents\s+do\s+i\s+need)\b/i.test(q)) {
    return workflowCtx.serviceId ? 'get_ebis_service' : 'discover_ebis_service';
  }
  if (/\b(which\s+service|what\s+do\s+i\s+need|find\s+a\s+bis|help\s+me\s+apply|eligib)\b/i.test(q)) {
    return 'discover_ebis_service';
  }
  if (wantsComplaintFiling(q)) {
    return 'get_ebis_service';
  }
  if (/\b(submit|fill\s+out|form-?i)\b/i.test(q) && !/\broadmap|step|cost|fee\b/i.test(q)) {
    return 'submit_portal_form';
  }
  if (router.intent === 'workflow_status') return 'get_workflow_status';
  if (router.tool === 'get_workflow_status') return 'get_workflow_status';
  if (router.tool === 'discover_ebis_service') return 'discover_ebis_service';
  if (router.tool === 'get_ebis_service') return 'get_ebis_service';
  return router.tool || 'get_certification_roadmap';
}

export async function discoverEbisService(query, workflowCtx = {}) {
  const q = workflowCtx.product
    ? `${query} ${workflowCtx.product}`
    : workflowCtx.isNumber
      ? `${query} ${workflowCtx.isNumber}`
      : query;

  const data = await fetchClone(`/api/ebis/discover?q=${encodeURIComponent(q)}`);
  const top = data.matches?.[0];
  if (!top) {
    return { ok: false, error: 'No matching BIS service found', query };
  }
  const detail = await fetchClone(`/api/ebis/services/${top.service_id}`);
  return {
    ok: true,
    service_id: detail.service_id,
    service_name: detail.service_name,
    persona: detail.persona,
    description: detail.description,
    eligibility: detail.eligibility,
    required_documents: detail.required_documents,
    form: detail.form,
    lifecycle_states: detail.lifecycle_states,
    source: detail.source,
    matches: data.matches,
  };
}

export async function getEbisService(serviceId) {
  const detail = await fetchClone(`/api/ebis/services/${serviceId}`);
  return { ok: true, ...detail };
}

export async function getWorkflowStatus(recordId, workflowCtx = {}) {
  const id = recordId
    || workflowCtx.recordId
    || workflowCtx.workflowId
    || workflowCtx.demoId;
  if (!id) {
    return { ok: false, error: 'No application or complaint ID provided' };
  }
  const data = await fetchClone(`/api/ebis/status/${encodeURIComponent(id)}`);
  return { ok: data.ok !== false, ...data };
}

export function formatWorkflowAnswer(result, query) {
  if (!result?.ok) {
    return result?.error || 'Could not retrieve workflow information.';
  }

  if (result.service_name && !result.current_status) {
    const docs = (result.required_documents || []).map(d => `• ${d}`).join('\n');
    const formNote = result.form ? `\n\nForm: ${result.form.title} (${result.form.fields?.length || 0} fields)` : '';
    return `${result.service_name}\n\n${result.description}\n\nEligibility: ${result.eligibility}\n\nRequired documents:\n${docs}${formNote}\n\nSource: ${result.source}`;
  }

  const status = result.current_status || result.result;
  const lines = [
    result.applicant_name ? `${result.applicant_name}` : null,
    `Status: ${status}`,
    result.current_step ? `Current step: ${result.current_step}` : null,
    result.next_action ? `Next action: ${result.next_action}` : null,
    result.record_id ? `Record: ${result.record_id}` : null,
    result.related_standard ? `Standard: ${result.related_standard}` : null,
    result.assigned_department ? `Department: ${result.assigned_department}` : null,
    `Source: ${result.source}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function workflowResultToProbe(tool, result) {
  return {
    tool,
    source: 'ebis_workflow',
    data: {
      ...result,
      outcome: result.current_status || result.service_name,
      status: result.current_status,
      steps: result.steps || result.lifecycle_states,
      next_action: result.next_action,
      required_documents: result.required_documents,
      form: result.form,
    },
  };
}

export function workflowResultToSources(result) {
  if (!result?.ok) return [];
  return [{
    type: 'workflow',
    recordId: result.record_id || result.workflow_id || result.service_id,
    title: result.service_name || result.applicant_name || result.record_id,
    demo_id: result.demo_id,
    source_reference: result.source,
    retrievalMethod: `workflow:${result.service_id || result.type}`,
  }];
}
