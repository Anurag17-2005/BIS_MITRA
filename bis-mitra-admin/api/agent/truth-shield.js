/**
 * Truth Shield — anti-hallucination guard.
 * Every engineering number and regulatory reference (IS number, record ID, licence, HUID)
 * in the draft answer must appear in the retrieved sources or the user's question.
 * Unverified spans are redacted; diagnostics go to `shield` metadata, not the answer text.
 */

const NUM_RE = /(?:Rs\.?\s*)?(?:₹\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(%|MPa|mpa|kPa|mm|cm|kg|kN|°C|kW|bar|psi|mins?|minutes|hours?|days?|years?|per\s+annum)\b/gi;

function normalizeNumberToken(raw) {
  const cleaned = String(raw).replace(/,/g, '').trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return {
    value: n,
    display: cleaned,
    forms: new Set([
      cleaned,
      String(n),
      n.toFixed(1),
      n.toFixed(2),
      n % 1 === 0 ? String(Math.trunc(n)) : cleaned,
    ]),
  };
}

export function extractNumericClaims(text) {
  const claims = [];
  const src = String(text || '');
  let m;
  const re = new RegExp(NUM_RE.source, 'gi');
  while ((m = re.exec(src))) {
    const full = m[0].trim();
    const num = normalizeNumberToken(m[1]);
    if (!num) continue;
    const before = src.slice(Math.max(0, m.index - 2), m.index);
    if (/^\d+\.\s/.test(full) || /^\s*\d+\.\s*$/.test(full)) continue;
    if (/^\d+\.$/.test(full) && before.endsWith('\n')) continue;

    claims.push({
      raw: full,
      value: num.value,
      forms: num.forms,
      unit: (m[2] || '').trim() || null,
      index: m.index,
    });
  }
  return claims;
}

function corpusAllows(claim, corpus) {
  for (const form of claim.forms) {
    if (!form) continue;
    if (claim.unit) {
      const u = claim.unit.toLowerCase().replace(/\s+/g, '\\s*');
      const unitRe = new RegExp(`${form.replace('.', '\\.')}\\s*${u}`, 'i');
      if (unitRe.test(corpus)) return true;
      const loose = new RegExp(`${form.replace('.', '\\.')}.{0,12}${u}`, 'i');
      if (loose.test(corpus)) return true;
    }
    const bare = new RegExp(`(?<![\\d.])${form.replace('.', '\\.')}(?![\\d])`);
    if (bare.test(corpus)) return true;
  }
  return false;
}

function buildSourceCorpus(hits = [], probe = null, extraCorpus = null) {
  const parts = [];
  for (const h of hits) {
    parts.push(h.text || '', h.textPreview || '', h.title || '');
    if (h.metadata) parts.push(JSON.stringify(h.metadata));
  }
  if (probe?.data) parts.push(JSON.stringify(probe.data));
  if (extraCorpus) parts.push(typeof extraCorpus === 'string' ? extraCorpus : JSON.stringify(extraCorpus));
  return parts.join('\n');
}

/**
 * Verify draft answer against sources. Redact unverified numeric spans.
 */
export function applyTruthShield(draftAnswer, { hits = [], probe = null, extraCorpus = null } = {}) {
  const corpus = buildSourceCorpus(hits, probe, extraCorpus);
  const claims = extractNumericClaims(draftAnswer);
  const verified = [];
  const blocked = [];
  let answer = draftAnswer;

  for (const claim of claims) {
    if (!claim.unit && claim.value >= 1900 && claim.value <= 2100) {
      verified.push({ ...claim, reason: 'year_or_date' });
      continue;
    }
    if (!claim.unit && claim.value >= 1 && claim.value <= 20 && Number.isInteger(claim.value)) {
      verified.push({ ...claim, reason: 'small_index' });
      continue;
    }
    if (corpusAllows(claim, corpus)) {
      verified.push({ ...claim, reason: 'source_match' });
    } else {
      blocked.push({ ...claim, reason: 'not_in_sources' });
    }
  }

  const uniqueBlocked = [...blocked].sort((a, b) => b.raw.length - a.raw.length);
  for (const b of uniqueBlocked) {
    const escaped = b.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    answer = answer.replace(new RegExp(escaped, 'g'), '[value not in sources]');
  }

  const refs = checkReferenceClaims(answer, corpus);
  answer = refs.answer;
  const blockedTotal = blocked.length + refs.blocked.length;
  const verifiedTotal = verified.length + refs.verified.length;
  const status = blockedTotal === 0 ? 'pass' : (verifiedTotal ? 'partial' : 'fail');
  if (refs.blocked.length) {
    answer += '\n\n_Some references were removed because they are not in the BIS sources for this answer._';
  }

  return {
    answer,
    shield: {
      status,
      verifiedCount: verifiedTotal,
      blockedCount: blockedTotal,
      verified: verified.slice(0, 20).map(v => ({ raw: v.raw, unit: v.unit })),
      blocked: blocked.slice(0, 20).map(v => ({ raw: v.raw, unit: v.unit })),
      references: { verified: refs.verified.slice(0, 20), blocked: refs.blocked.slice(0, 20) },
    },
  };
}

// Regulatory references the model must never invent: IS numbers, demo/record IDs, licence numbers, HUIDs.
const REF_RES = [
  { kind: 'is_number', re: /\bIS\s*(?:DEMO\s*)?\d{1,5}(?:\s*\(\s*Part\s*\d+\s*\))?(?:\s*:\s*\d{4})?(?![\w])/gi },
  { kind: 'record_id', re: /\b[A-Z]{2,6}-DEMO-[A-Z0-9-]+\b/g },
  { kind: 'licence', re: /\bCM\/L[\s-]?\d{6,10}\b/gi },
  { kind: 'huid', re: /\bHUID[\s-]?[A-Z0-9]{6}\b/gi },
];

const squash = (s) => String(s).toLowerCase().replace(/[\s\-/:()]+/g, '');

/**
 * Remove regulatory references that do not appear in the evidence corpus (or the user's question).
 * An IS number cited without an edition year is accepted when the base number is in the corpus.
 */
export function checkReferenceClaims(text, corpus) {
  const hay = squash(corpus);
  const verified = [];
  const blocked = [];
  let answer = String(text || '');
  for (const { kind, re } of REF_RES) {
    const found = [...new Set(answer.match(new RegExp(re.source, re.flags)) || [])];
    for (const ref of found) {
      const key = squash(ref);
      const base = kind === 'is_number' ? squash(ref.split(':')[0]) : key;
      if (hay.includes(key) || (kind === 'is_number' && hay.includes(base))) {
        verified.push({ kind, raw: ref });
      } else {
        blocked.push({ kind, raw: ref });
        const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        answer = answer.replace(new RegExp(`\\*{0,2}${escaped}\\*{0,2}`, 'g'), '[reference not in sources]');
      }
    }
  }
  return { answer, verified, blocked };
}

export function extractVerifiedFacts(hits = [], limit = 5) {
  const facts = [];
  for (const h of hits) {
    const text = h.text || h.textPreview || '';
    const claims = extractNumericClaims(text).filter(c => c.unit);
    for (const c of claims.slice(0, 2)) {
      facts.push({
        claim: c.raw,
        citation: h.citation?.citation_anchor || h.title,
        chunkId: h.chunkId,
      });
      if (facts.length >= limit) return facts;
    }
  }
  return facts;
}
