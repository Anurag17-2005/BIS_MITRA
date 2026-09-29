/**
 * Truth Shield — anti-hallucination guard for numeric claims.
 * Every engineering number in the draft answer must appear in retrieved sources.
 * Unverified numbers are redacted before the user sees the answer.
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
    answer = answer.replace(new RegExp(escaped, 'g'), '[UNVERIFIED NUMBER REMOVED]');
  }

  const status = blocked.length === 0 ? 'pass' : (verified.length ? 'partial' : 'fail');

  if (blocked.length) {
    answer += `\n\n⚠ Truth Shield: blocked ${blocked.length} numeric claim(s) not found in source documents`
      + ` (${blocked.slice(0, 3).map(b => b.raw).join(', ')}${blocked.length > 3 ? '…' : ''}).`;
  } else if (verified.length) {
    answer += `\n\n✓ Truth Shield: ${verified.length} numeric claim(s) verified against sources.`;
  }

  return {
    answer,
    shield: {
      status,
      verifiedCount: verified.length,
      blockedCount: blocked.length,
      verified: verified.slice(0, 20).map(v => ({ raw: v.raw, unit: v.unit })),
      blocked: blocked.slice(0, 20).map(v => ({ raw: v.raw, unit: v.unit })),
    },
  };
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
