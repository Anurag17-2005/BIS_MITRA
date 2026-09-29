import { executeProbeApi } from '../core/probes.js';

const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

async function cloneGet(path) {
  const url = `${CLONE_API.replace(/\/$/, '')}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Clone API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function evaluateCondition(fieldValue, operator, expected) {
  if (expected === 'today') {
    const d = String(fieldValue || '').slice(0, 10);
    if (operator === '>=') return d >= todayIso();
    if (operator === '<') return d < todayIso();
  }
  if (operator === '==') return String(fieldValue) === String(expected);
  if (operator === '!=') return String(fieldValue) !== String(expected);
  return false;
}

function pickEvidence(record) {
  if (!record || typeof record !== 'object') return record;
  const {
    demo_id,
    source_file,
    source_reference,
    is_number,
    title,
    status,
    product,
    gazette_ref,
    cml_number,
    licence_number,
    company_name,
    valid_until,
    lab_code,
    name,
    huid,
    amendment_no,
    clause_ref,
    summary,
  } = record;
  return {
    demo_id,
    source_file,
    source_reference,
    is_number,
    title,
    status,
    product,
    gazette_ref,
    cml_number,
    licence_number,
    company_name,
    valid_until,
    lab_code,
    name,
    huid,
    amendment_no,
    clause_ref,
    summary,
    ...(record.found !== undefined ? { found: record.found } : {}),
  };
}

function buildResult(rule, outcome, evidence, extra = {}) {
  const ev = Array.isArray(evidence)
    ? evidence.map(pickEvidence)
    : pickEvidence(evidence);
  const passed = rule.type === 'comparison'
    ? outcome && !['NOT_FOUND', 'NO_AMENDMENT', 'NOT_APPLICABLE'].includes(outcome)
    : (outcome === rule.result || String(outcome).toUpperCase() === String(rule.result).toUpperCase());
  return {
    ok: true,
    ruleId: rule.id,
    ruleName: rule.name,
    type: rule.type,
    source: rule.source || rule.category,
    connector: rule.connector || null,
    apiPath: rule.apiPath || null,
    outcome,
    passed,
    evidence: ev,
    evaluatedAt: new Date().toISOString(),
    ...extra,
  };
}

function normalizeIs(q) {
  return String(q || '').trim().replace(/\s+/g, ' ');
}

async function execStandardValidation(rule, inputs) {
  const isn = normalizeIs(inputs.is_number || inputs.query);
  const rows = await cloneGet(`/api/standards?q=${encodeURIComponent(isn)}`);
  const hit = (rows || []).find(s =>
    normalizeIs(s.is_number).toLowerCase() === isn.toLowerCase()
  ) || (rows || [])[0];
  if (!hit) {
    return buildResult(rule, 'NOT_FOUND', { query: isn, resultCount: 0 });
  }
  return buildResult(rule, 'FOUND', hit);
}

async function execQcoApplicability(rule, inputs) {
  const q = normalizeIs(inputs.is_number || inputs.product || inputs.query);
  const { results } = await executeProbeApi('qco_search', q);
  const hit = results?.[0];
  if (!hit) {
    return buildResult(rule, 'NOT_APPLICABLE', { query: q, resultCount: 0 });
  }
  return buildResult(rule, 'APPLICABLE', hit);
}

async function execLicenceStatus(rule, inputs) {
  const cml = String(inputs.cml || inputs.query || '').trim();
  const data = await executeProbeApi('registry_verification', cml);
  if (!data.found) {
    return buildResult(rule, 'NOT_FOUND', data);
  }
  const active = data.status?.toLowerCase() === 'active'
    || (data.valid_until && evaluateCondition(data.valid_until, '>=', 'today'));
  return buildResult(rule, active ? 'ACTIVE' : 'INACTIVE', data);
}

async function execLabStatus(rule, inputs) {
  const q = String(inputs.lab_code || inputs.query || '').trim();
  const { results } = await executeProbeApi('labs_search', q);
  const hit = results?.find(l =>
    String(l.lab_code || '').toLowerCase() === q.toLowerCase()
  ) || results?.[0];
  if (!hit) {
    return buildResult(rule, 'NOT_FOUND', { query: q, resultCount: 0 });
  }
  return buildResult(rule, 'FOUND', hit);
}

async function execHuidValidation(rule, inputs) {
  const huid = String(inputs.huid || inputs.query || '').trim().toUpperCase();
  const data = await cloneGet(`/api/gold/huid/verify?huid=${encodeURIComponent(huid)}`);
  const found = data.found === true;
  return buildResult(rule, found ? 'FOUND' : 'NOT_FOUND', data);
}

async function execAmendmentCheck(rule, inputs) {
  const isn = normalizeIs(inputs.is_number || inputs.query);
  const rows = await cloneGet(`/api/amendments?is_number=${encodeURIComponent(isn)}`);
  if (!rows?.length) {
    return buildResult(rule, 'NO_AMENDMENT', { is_number: isn, resultCount: 0 });
  }
  return buildResult(rule, 'AMENDMENT_FOUND', {
    is_number: isn,
    amendment_count: rows.length,
    amendments: rows,
    latest: rows[0],
  }, {
    display: `${rows.length} amendment(s)`,
  });
}

const EXECUTORS = {
  standard_validation: execStandardValidation,
  qco_applicability: execQcoApplicability,
  licence_status: execLicenceStatus,
  lab_status: execLabStatus,
  huid_validation: execHuidValidation,
  amendment_check: execAmendmentCheck,
};

/**
 * Execute a deterministic rule against existing BIS Clone APIs.
 */
export async function executeRule(rule, inputs = {}) {
  if (!rule.enabled) {
    return { ok: false, error: 'Rule is disabled', ruleId: rule.id };
  }
  const fn = EXECUTORS[rule.executor];
  if (!fn) {
    return { ok: false, error: `No executor for ${rule.executor}`, ruleId: rule.id };
  }
  try {
    return await fn(rule, inputs);
  } catch (err) {
    return { ok: false, error: err.message, ruleId: rule.id, ruleName: rule.name };
  }
}
