import { listRules, getRule } from '../rules/rules-store.js';
import { executeRule } from '../rules/rules-engine.js';
import { extractIdentifiers } from '../retrieval/identifiers.js';

/** Map router capability / intent → default rule id */
const INTENT_RULE_MAP = {
  status: 'STATUS-CML-001',
  validation: 'VAL-STD-001',
  eligibility: 'VAL-QCO-001',
  comparison: 'VAL-AMD-001',
  verification: 'STATUS-CML-001',
};

function extractToken(query, patterns) {
  for (const re of patterns) {
    const m = String(query).match(re);
    if (m) return m[0].trim();
  }
  return null;
}

/**
 * Pick the best enabled rule for a routed query.
 */
export function pickRuleId(router, query, identifiers = {}) {
  if (router.ruleId) return router.ruleId;

  const ids = identifiers?.hasExactId ? identifiers : extractIdentifiers(query);

  if (ids.cmlIds?.length || /\b(cml[\s-]?demo|licen[cs]e.*active|active.*licen[cs]e)\b/i.test(query)) {
    return 'STATUS-CML-001';
  }
  if (ids.huidCodes?.length || /\bHUID[\s-][A-Z0-9-]+/i.test(query)) {
    return 'VAL-HUID-001';
  }
  if (ids.labIds?.length || /\bLAB[\s-]?ID[\s-]?DEMO/i.test(query)) {
    return 'VAL-LAB-001';
  }
  if (/\b(amendment|revision)\b/i.test(query) && (ids.isNumbers?.length || /IS\s/i.test(query))) {
    return 'VAL-AMD-001';
  }
  if (/\bqco\b/i.test(query) || router.intent === 'eligibility') {
    return 'VAL-QCO-001';
  }
  if (ids.isNumbers?.length || /\bIS\s*DEMO|\bIS\s*\d/i.test(query)) {
    if (router.intent === 'comparison') return 'VAL-AMD-001';
    if (/\b(exist|valid|found|identify)\b/i.test(query)) return 'VAL-STD-001';
    if (router.intent === 'eligibility') return 'VAL-QCO-001';
    return 'VAL-STD-001';
  }

  return INTENT_RULE_MAP[router.intent] || null;
}

/**
 * Build rule executor inputs from query + identifiers.
 */
export function buildRuleInputs(rule, query, identifiers = {}) {
  const ids = identifiers?.hasExactId ? identifiers : extractIdentifiers(query);
  const inputs = {};

  for (const inp of rule.testInputs || []) {
    if (inp.key === 'cml') {
      inputs.cml = ids.cmlIds?.[0]
        || extractToken(query, [/CML[\s-]?DEMO[\s-]?[\w]+/i, /CML[\s-]?[\w-]+/i])
        || extractToken(query, [/\b\d{7}\b/]);
    }
    if (inp.key === 'huid') {
      inputs.huid = ids.huidCodes?.[0]
        || extractToken(query, [/HUID[\s-]?[A-Z0-9-]+/i]);
    }
    if (inp.key === 'lab_code') {
      inputs.lab_code = ids.labIds?.[0]
        || extractToken(query, [/LAB[\s-]?ID[\s-]?DEMO[\s-]?[\w]+/i, /LAB[\s-]?[\w-]+/i]);
    }
    if (inp.key === 'is_number') {
      inputs.is_number = ids.isNumbers?.[0]
        || extractToken(query, [/IS\s*DEMO\s*[\d][\d\s().:A-Z-]*/i, /IS\s*[\d][\d\s().:A-Z-]*/i]);
    }
    if (inp.key === 'product' && !inputs.is_number) {
      inputs.product = query.replace(/\?/g, '').trim();
    }
  }

  if (!Object.values(inputs).some(Boolean)) {
    inputs.query = query;
  }

  return inputs;
}

/**
 * Run a deterministic BIS rule (reuses admin rules engine).
 */
export async function runDeterministicRule(router, query, identifiers = {}) {
  const ruleId = pickRuleId(router, query, identifiers);
  if (!ruleId) {
    return { ok: false, error: 'No matching deterministic rule', ruleId: null };
  }

  const rule = getRule(ruleId) || listRules().find(r => r.id === ruleId);
  if (!rule) {
    return { ok: false, error: `Rule ${ruleId} not found`, ruleId };
  }

  const inputs = buildRuleInputs(rule, query, identifiers);
  const result = await executeRule(rule, inputs);

  return {
    ...result,
    rule_id: rule.id,
    ruleId: rule.id,
    rule_name: rule.name,
    inputs,
    source: result.source || rule.source,
    evidence: result.evidence,
    result: result.outcome,
  };
}

export function formatRuleAnswer(ruleResult) {
  if (!ruleResult?.ok) {
    return ruleResult?.error || 'Could not run the deterministic rule.';
  }
  const outcome = ruleResult.display || ruleResult.outcome || ruleResult.result;
  const ev = ruleResult.evidence || {};
  const label = ev.cml_number || ev.is_number || ev.huid || ev.lab_code || ev.title || '';
  const prefix = label ? `${label}: ` : '';
  return `${prefix}${outcome}.\n\nRule: ${ruleResult.rule_id}\nSource: ${ruleResult.source}`;
}

export function ruleResultToProbe(ruleResult) {
  if (!ruleResult?.ok) {
    return {
      tool: 'run_deterministic_rule',
      data: ruleResult,
      source: 'rules_engine',
    };
  }
  return {
    tool: 'run_deterministic_rule',
    rule_id: ruleResult.rule_id,
    source: ruleResult.source,
    data: {
      outcome: ruleResult.outcome,
      result: ruleResult.result,
      rule_id: ruleResult.rule_id,
      rule_name: ruleResult.rule_name,
      source: ruleResult.source,
      evidence: ruleResult.evidence,
      passed: ruleResult.passed,
      connector: ruleResult.connector,
      apiPath: ruleResult.apiPath,
    },
  };
}

export function ruleResultToSources(ruleResult) {
  if (!ruleResult?.ok || !ruleResult.evidence) return [];
  const ev = ruleResult.evidence;
  const title = ev.title || ev.company_name || ev.is_number || ev.huid || ev.lab_code || ruleResult.rule_name;
  return [{
    type: 'rule',
    recordId: ruleResult.rule_id,
    title,
    demo_id: ev.demo_id,
    source_file: ev.source_file,
    source_reference: ev.source_reference,
    retrievalMethod: `rule:${ruleResult.rule_id}`,
  }];
}

export function listEnabledRules() {
  return listRules().filter(r => r.enabled);
}
