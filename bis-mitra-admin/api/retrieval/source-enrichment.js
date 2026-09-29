const ID = /\b[A-Z]{2,5}-DEMO-\d{3}\b/g;

export function isJsonRecord(text) {
  const t = String(text || '').trim();
  return /^\s*\{/.test(t) && /"demo_id"\s*:/.test(t);
}

export function jsonRecordToPreview(text) {
  try {
    const o = JSON.parse(text);
    const rec = o.record || o;
    const id = o.demo_id || rec.demo_id;
    const parts = [];
    if (id) parts.push(id);
    for (const k of ['product', 'title', 'mandatory_certification', 'status', 'scheme', 'is_number']) {
      if (rec[k] != null && rec[k] !== '') parts.push(`${k.replace(/_/g, ' ')}: ${rec[k]}`);
    }
    return parts.join(' · ') || id || 'Record';
  } catch {
    return String(text).slice(0, 120);
  }
}

export function jsonRecordId(text) {
  try {
    const o = JSON.parse(text);
    return o.demo_id || o.record?.demo_id || null;
  } catch {
    const m = String(text).match(ID);
    return m?.[0] || null;
  }
}

export function pickEvidence(text, query, n = 2) {
  const terms = [...new Set(String(query || '').toLowerCase().match(/[a-z0-9][a-z0-9:.\-()]{2,}/g) || [])];
  const parts = String(text || '')
    .split(/\n+|(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 220);
  return parts
    .map((s) => ({
      s,
      i: text.indexOf(s),
      score: terms.reduce((a, t) => a + (s.toLowerCase().includes(t) ? 1 : 0), 0)
        + (/mandatory|voluntary|effective|status|scheme|licen[cs]e|fee|₹/i.test(s) ? 0.5 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export function recordIdFor(text, pos = 0) {
  const ids = [...String(text || '').matchAll(ID)].filter((m) => m.index <= pos);
  if (ids.length) return ids[ids.length - 1][0];
  return String(text || '').match(ID)?.[0] || null;
}

export function enrichChunkFields(hit, query) {
  const text = hit.text || hit.textPreview || '';
  const meta = hit.metadata || {};

  // Keep estimated pages for scroll-to-page; confidence tells UI not to claim precision.
  hit.page_number = meta.page_number || hit.page_number || null;
  hit.page_number_confidence = hit.page_number
    ? (meta.page_number_confidence || hit.page_number_confidence || 'estimated')
    : null;

  if (isJsonRecord(text)) {
    const record_id = jsonRecordId(text) || meta.demo_id || meta.record_id || null;
    let parsed = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    const rec = parsed.record || parsed;

    const EVIDENCE_FIELDS = [
      'mandatory_certification', 'status', 'scheme', 'effective_date',
      'enforcement_status', 'is_number', 'product', 'title',
      'mandatory_status', 'scope', 'company_name',
    ];
    const evidence = EVIDENCE_FIELDS
      .filter((k) => rec[k] != null && rec[k] !== '')
      .map((k) => `${k.replace(/_/g, ' ')}: ${rec[k]}`)
      .slice(0, 3);

    const preview = jsonRecordToPreview(text);
    const spans = evidence.length ? evidence : [preview];
    return {
      record_id,
      evidence: spans,
      label: record_id ? `${record_id} · ${spans[0] || preview}` : preview,
      textPreview: spans.join(' · ') || preview,
      passage: spans[0] || preview,
    };
  }

  const ev = pickEvidence(text, query);
  const evidence = ev.map((x) => x.s);
  const record_id = meta.record_id || recordIdFor(text, ev[0]?.i ?? 0) || meta.demo_id || null;
  const label = [record_id, evidence[0]].filter(Boolean).join(' · ')
    || hit.passage
    || null;

  return {
    record_id,
    evidence,
    label,
    textPreview: evidence[0] || hit.textPreview,
    passage: label,
  };
}
