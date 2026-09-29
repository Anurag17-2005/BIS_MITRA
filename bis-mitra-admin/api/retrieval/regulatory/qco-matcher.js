import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'qco-registry.json'), 'utf8')
);

function normalizeIs(isNumber) {
  if (!isNumber) return null;
  return String(isNumber).replace(/\s+/g, ' ').trim();
}

function isCore(isNumber) {
  const m = normalizeIs(isNumber)?.match(/IS\s*(\d+)/i);
  return m ? m[1] : null;
}

function lookupKey(isNumber) {
  const n = normalizeIs(isNumber);
  if (!n) return null;
  if (REGISTRY[n]) return n;
  const core = isCore(n);
  if (!core) return null;
  // Prefer exact year match, else any registry entry with same IS core number
  const sameCore = Object.keys(REGISTRY).filter(k => isCore(k) === core);
  if (!sameCore.length) return null;
  const exact = sameCore.find(k => k.replace(/\s+/g, ' ') === n);
  return exact || sameCore[0];
}

/**
 * Determine MANDATORY / VOLUNTARY / TRANSITIONAL_PHASE for an IS number.
 */
export function evaluateEnforcementState(isNumber, asOf = new Date()) {
  const key = lookupKey(isNumber);
  if (!key) {
    return {
      enforcement_status: 'VOLUNTARY',
      notifying_gazette_id: null,
      notifying_ministry: null,
      legal_statute: null,
      scheme: null,
      effective_date: null,
      legal_caveat: 'No active Quality Control Order found — standard acts as a voluntary quality reference unless otherwise notified.',
      is_number: normalizeIs(isNumber),
    };
  }

  const rec = REGISTRY[key];
  const today = asOf instanceof Date ? asOf : new Date(asOf);
  const deadline = new Date(rec.effective_date + 'T00:00:00');

  if (today >= deadline) {
    return {
      enforcement_status: 'MANDATORY',
      notifying_gazette_id: rec.gazette_reference_id,
      notifying_ministry: rec.ministry,
      legal_statute: rec.legal_statute,
      scheme: rec.scheme,
      effective_date: rec.effective_date,
      product: rec.product,
      sector: rec.sector,
      legal_caveat: `Non-compliance risks enforcement under ${rec.ministry} mandate (${rec.gazette_reference_id}).`,
      is_number: key,
    };
  }

  return {
    enforcement_status: 'TRANSITIONAL_PHASE',
    notifying_gazette_id: rec.gazette_reference_id,
    notifying_ministry: rec.ministry,
    legal_statute: rec.legal_statute,
    scheme: rec.scheme,
    effective_date: rec.effective_date,
    product: rec.product,
    sector: rec.sector,
    legal_caveat: `Becomes fully mandatory on ${rec.effective_date}. Units must align testing and marking infrastructure before that date.`,
    is_number: key,
  };
}

export function bestEnforcementForIsList(isNumbers = []) {
  const ranked = { MANDATORY: 3, TRANSITIONAL_PHASE: 2, VOLUNTARY: 1 };
  let best = evaluateEnforcementState(null);
  for (const isn of isNumbers) {
    const st = evaluateEnforcementState(isn);
    if ((ranked[st.enforcement_status] || 0) > (ranked[best.enforcement_status] || 0)) {
      best = st;
    }
  }
  return best;
}

export function getQcoRegistry() {
  return REGISTRY;
}
