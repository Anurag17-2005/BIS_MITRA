/**
 * Extract structured identifiers from user queries.
 */

// IS numbers: "IS 2082", "IS 2082:2018", "IS 1786 (Part 2):2008", "IS DEMO 1001:2026" — never trailing words.
const IS_RE = /\bIS\s*(?:DEMO\s*)?\d{1,5}(?:\s*\(\s*Part\s*\d+\s*\))?(?:\s*:\s*\d{4})?(?![\w])/gi;
const QCO_RE = /\bQCO[\s-]?(?:DEMO[\s-][\w-]+|[A-Z0-9][\w-]{2,})\b/gi;
const CML_RE = /\b(?:CM\/L[\s-]?|CML[\s-]?)?(?:DEMO[\s-])?[\d]{6,10}\b/gi;
const LICENCE_RE = /\b(?:CML|LIC)[\s-]?DEMO[\s-]?[\w-]+/gi;
const HUID_RE = /\bHUID[\s-]?[A-Z0-9-]{6,20}\b/gi;
const LAB_RE = /\b(?:LAB|LRS)[\s-]?DEMO[\s-]?[\w-]+/gi;
// Prefix must be followed by a separator. CON is only valid as CON-GRP.
// "consumer", "contact", "conformity", and "enforcement" must not match.
const CASE_RE = /\b(?:ENF|CMP|SURV)[\s-](?:DEMO(?:[\s-][A-Z0-9][\w-]*)?|[A-Z0-9][\w-]*)\b|\bCON[\s-]GRP(?:[\s-][A-Z0-9][\w-]*)?\b/gi;
const APP_RE = /\b(?:BIS-APP|ISI|LAB-APP|WF)-[\w-]+|\b(?:CERT|CMP)-DEMO[\s-][\w-]+/gi;

export function extractIdentifiers(query) {
  const q = String(query || '');
  const isNumbers = [...new Set((q.match(IS_RE) || []).map(s => s.replace(/\s+/g, ' ').trim()))];
  const qcoIds = [...new Set((q.match(QCO_RE) || []).map(s => s.trim()))];
  const cmlIds = [...new Set([
    ...(q.match(CML_RE) || []),
    ...(q.match(LICENCE_RE) || []),
  ].map(s => s.replace(/^CM\/L[\s-]?/i, '').trim()))];
  const huidCodes = [...new Set((q.match(HUID_RE) || []).map(s => s.trim()))];
  const labIds = [...new Set((q.match(LAB_RE) || []).map(s => s.trim()))];
  const caseIds = [...new Set((q.match(CASE_RE) || []).map(s => s.trim()))];
  const appIds = [...new Set((q.match(APP_RE) || []).map(s => s.trim()))];

  const types = [];
  if (isNumbers.length) types.push('is_number');
  if (qcoIds.length) types.push('qco');
  if (cmlIds.length) types.push('cml');
  if (huidCodes.length) types.push('huid');
  if (labIds.length) types.push('lab');
  if (caseIds.length) types.push('case');
  if (appIds.length) types.push('application');

  return {
    isNumbers,
    qcoIds,
    cmlIds,
    huidCodes,
    labIds,
    caseIds,
    appIds,
    types,
    hasExactId: types.length > 0,
  };
}

/** Map identifier type → probe connector for exact lookup */
export function connectorForIdentifier(ids) {
  if (ids.huidCodes?.length) return { connector: 'huid_verify', token: ids.huidCodes[0] };
  if (ids.cmlIds?.length) return { connector: 'registry_verification', token: ids.cmlIds[0] };
  if (ids.isNumbers?.length) return { connector: 'standard_detail', token: ids.isNumbers[0] };
  if (ids.qcoIds?.length) return { connector: 'qco_search', token: ids.qcoIds[0] };
  if (ids.labIds?.length) return { connector: 'labs_search', token: ids.labIds[0] };
  if (ids.caseIds?.some(c => /^ENF/i.test(c))) {
    return { connector: 'enforcement_search', token: ids.caseIds.find(c => /^ENF/i.test(c)) };
  }
  if (ids.caseIds?.some(c => /^SURV/i.test(c))) {
    return { connector: 'surveillance_search', token: ids.caseIds.find(c => /^SURV/i.test(c)) };
  }
  if (ids.caseIds?.some(c => /^(CMP|CON)/i.test(c))) {
    return { connector: 'consumer_complaints_search', token: ids.caseIds.find(c => /^(CMP|CON)/i.test(c)) };
  }
  if (ids.appIds?.length) return { connector: 'application_search', token: ids.appIds[0] };
  return null;
}
