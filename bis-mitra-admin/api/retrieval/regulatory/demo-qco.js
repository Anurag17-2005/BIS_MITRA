import { enrichChunkFields } from '../source-enrichment.js';
import { resolvePdfStorageFromHit } from '../source-files.js';
import { resolvePortalUrl } from '../portal-provenance.js';

const CLONE = process.env.CLONE_API || 'http://localhost:4000';

export async function lookupQcoByIsNumber(isNumber) {
  if (!isNumber) return null;
  try {
    const q = encodeURIComponent(String(isNumber).trim());
    const res = await fetch(`${CLONE}/api/qco?is_number=${q}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(isNumber);
    return rows.find((r) => norm(r.is_number) === want)
      || rows.find((r) => norm(r.is_number).includes(want) || want.includes(norm(r.is_number)))
      || rows[0];
  } catch {
    return null;
  }
}

export function authoritativeEnforcementLine(q) {
  if (!q) return null;
  const mandatory = q.enforcement_status === 'MANDATORY' || /yes/i.test(String(q.mandatory_certification || ''));
  return [
    'AUTHORITATIVE ENFORCEMENT FACT:',
    q.demo_id || q.gazette_ref,
    q.is_number,
    `Mandatory certification: ${mandatory ? 'Yes' : q.enforcement_status || 'See QCO'}`,
    `Scheme: ${q.scheme || '—'}`,
    `Effective: ${q.effective_date || '—'}`,
    `Status: ${q.enforcement_status || 'Active'}`,
  ].join(' | ');
}

export function buildQcoAuthoritativeChunk(q, query) {
  const text = [
    q.demo_id,
    q.product,
    `IS Number: ${q.is_number}`,
    'Mandatory certification Yes',
    `Scheme: ${q.scheme}`,
    `Effective: ${q.effective_date}`,
    q.legal_statute || '',
  ].join('\n');

  const hit = {
    chunkId: `qco-auth-${q.demo_id}`,
    text,
    textPreview: text.slice(0, 200),
    title: `${q.demo_id} — ${q.product}`,
    // Keep below authoritativeScoreIgnoreAt only for display ranking; source-cap
    // also treats qco_join as authoritative so it never sets the relative floor.
    score: 0.92,
    chunkIndex: 0,
    authoritative: true,
    metadata: {
      demo_id: q.demo_id,
      record_id: q.demo_id,
      source_file: q.source_file || 'qco_demo.pdf',
      is_number: q.is_number,
    },
    citation: { source_url: q.source_reference || null },
  };
  hit.storage_uri = resolvePdfStorageFromHit(hit) || 'knowledge/pdfs/demo/qco_demo.pdf';
  const fields = enrichChunkFields(hit, query);
  const portalUrl = resolvePortalUrl({
    storage_uri: hit.storage_uri,
    retrievalMethod: 'qco_join',
    metadata: hit.metadata,
  });
  return {
    chunkId: hit.chunkId,
    recordId: q.demo_id,
    demo_id: q.demo_id,
    source_file: 'qco_demo.pdf',
    storage_uri: hit.storage_uri,
    source_reference: q.source_reference || null,
    sourceUrl: portalUrl || q.source_reference || null,
    portalUrl,
    section: 'schemes',
    chunkIndex: 0,
    page_number: null,
    page_number_confidence: null,
    passage: fields.label,
    title: hit.title,
    text,
    textPreview: fields.textPreview,
    score: 0.92,
    authoritative: true,
    retrievalMethod: 'qco_join',
    is_number: q.is_number,
    record_id: q.demo_id,
    evidence: fields.evidence.length ? fields.evidence : ['Mandatory certification Yes'],
    label: fields.label || `${q.demo_id} · Mandatory certification Yes`,
    provenance: { demo_id: q.demo_id, is_number: q.is_number, source_file: 'qco_demo.pdf' },
  };
}

export async function attachQcoAuthoritativeSources(chunks, query, isNumbers = []) {
  const fromQuery = String(query || '').match(/IS\s*[\d\s().A-Z:-]+/gi) || [];
  const fromChunks = chunks.map((c) => c.is_number).filter(Boolean);
  const candidates = [...new Set([...fromQuery, ...fromChunks].map((s) => String(s).replace(/\s+/g, ' ').trim()))];

  let injected = null;
  for (const isn of candidates) {
    const q = await lookupQcoByIsNumber(isn);
    if (!q?.demo_id) continue;
    const hasAuth = chunks.some(
      (c) => c.retrievalMethod === 'qco_join'
        && (c.demo_id === q.demo_id || c.record_id === q.demo_id),
    );
    if (!hasAuth) chunks.unshift(buildQcoAuthoritativeChunk(q, query));
    injected = { q, line: authoritativeEnforcementLine(q) };
    break;
  }
  return injected;
}
