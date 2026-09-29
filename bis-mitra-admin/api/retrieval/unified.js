import { executeProbeApi } from '../core/probes.js';
import { filterRelevantHits, cleanPreview } from '../agent/intent.js';
import { extractIdentifiers, connectorForIdentifier } from './identifiers.js';
import { getIndexStatus } from './index-status.js';
import { searchIndexTraced } from './trace-search.js';
import { extractQueryEntities } from './entities.js';
import { resolvePdfStorageFromHit, passageLabel } from './source-files.js';
import { enrichChunkFields } from './source-enrichment.js';
import { attachQcoAuthoritativeSources } from './regulatory/demo-qco.js';
import { resolvePortalUrl } from './portal-provenance.js';
import { SCORE_POLICY } from './score-policy.js';

const INSUFFICIENT = 'Insufficient evidence in the published knowledge index to answer this confidently.';

function mapChunk(hit, method, query) {
  const meta = hit.metadata || {};
  // Keep estimated pages for PdfViewer scroll fallback; confidence flags precision.
  const page_number = meta.page_number || null;
  const page_number_confidence = page_number
    ? (meta.page_number_confidence || 'estimated')
    : null;

  const baseText = hit.text || hit.textPreview || '';
  const enriched = enrichChunkFields({
    ...hit,
    text: baseText,
    textPreview: cleanPreview(baseText, 200),
    passage: passageLabel(baseText, hit.chunkIndex ?? 0) || null,
    page_number,
    page_number_confidence,
    metadata: meta,
  }, query);

  const portalUrl = resolvePortalUrl({
    ...hit,
    storage_uri: resolvePdfStorageFromHit(hit),
    metadata: meta,
    retrievalMethod: method,
  });

  return {
    chunkId: hit.chunkId,
    recordId: hit.warehouseItemId || hit.goldenId || meta.demo_id || null,
    demo_id: meta.demo_id || null,
    source_file: meta.source_file || null,
    storage_uri: resolvePdfStorageFromHit(hit),
    source_reference: meta.source_reference || meta.source_url || null,
    sourceUrl: portalUrl || hit.citation?.source_url || meta.source_url || meta.source_reference || null,
    portalUrl,
    sourceType: meta.source_type || hit.citation?.license_class || null,
    section: hit.section || meta.section || null,
    chunkIndex: hit.chunkIndex ?? null,
    page_number,
    page_number_confidence,
    passage: enriched.passage || enriched.label || null,
    record_id: enriched.record_id,
    evidence: enriched.evidence || [],
    label: enriched.label,
    domain: hit.domain || meta.domain || hit.sectionTag || null,
    title: hit.title || null,
    text: hit.text || hit.textPreview || '',
    textPreview: enriched.textPreview || cleanPreview(baseText, 200),
    score: hit.score,
    scoreLexical: hit.scoreLexical,
    scoreDense: hit.scoreDense,
    relevance: hit.score,
    retrievalMethod: method,
    is_number: meta.is_number || hit.is_number || null,
    provenance: {
      demo_id: meta.demo_id,
      source_file: meta.source_file,
      source_reference: meta.source_reference,
      is_number: meta.is_number,
      language: meta.language || 'en',
      version: meta.version || meta.effective_date || null,
      chunkId: hit.chunkId,
      recordId: hit.warehouseItemId || hit.goldenId || meta.demo_id || null,
      section: hit.section || meta.section || null,
      domain: hit.domain || meta.domain || hit.sectionTag || null,
    },
  };
}

function mapRecord(data, connector, method) {
  if (!data) return null;
  const results = data.results || (Array.isArray(data) ? data : null);
  if (results?.length) {
    return results.map((r, i) => ({
      recordId: r.demo_id || r.id || r.reference_id || r.case_id || r.ticket_id || `${connector}-${i}`,
      demo_id: r.demo_id || null,
      source_file: r.source_file || null,
      source_reference: r.source_reference || r.is_number || r.qco_number || null,
      title: r.title || r.company_name || r.product_name || r.case_id || null,
      is_number: r.is_number || null,
      data: r,
      retrievalMethod: method,
      provenance: {
        demo_id: r.demo_id,
        source_file: r.source_file,
        source_reference: r.source_reference,
        recordId: r.demo_id || r.id || r.reference_id,
      },
    }));
  }
  if (data.found === false || data.resultCount === 0) return [];
  return [{
    recordId: data.demo_id || data.is_number || data.cml || data.huid || connector,
    demo_id: data.demo_id || null,
    source_file: data.source_file || null,
    source_reference: data.source_reference || data.is_number || null,
    title: data.title || data.status || data.company_name || null,
    is_number: data.is_number || null,
    data,
    retrievalMethod: method,
    provenance: {
      demo_id: data.demo_id,
      source_file: data.source_file,
      source_reference: data.source_reference,
      recordId: data.demo_id || data.cml || data.huid,
    },
  }];
}

function buildSources(chunks, records) {
  const out = [];
  for (const c of chunks) {
    out.push({
      type: 'chunk',
      chunkId: c.chunkId,
      title: c.title,
      section: c.section,
      score: c.score,
      demo_id: c.demo_id,
      source_file: c.source_file,
      storage_uri: c.storage_uri || null,
      source_reference: c.source_reference,
      sourceUrl: c.portalUrl || c.sourceUrl || c.source_reference || null,
      portalUrl: c.portalUrl || null,
      domain: c.domain || null,
      textPreview: c.textPreview,
      chunkIndex: c.chunkIndex ?? null,
      page_number: c.page_number ?? null,
      page_number_confidence: c.page_number_confidence ?? null,
      record_id: c.record_id ?? null,
      evidence: c.evidence || [],
      label: c.label || c.passage || null,
      passage: c.passage || null,
      retrievalMethod: c.retrievalMethod,
    });
  }
  for (const r of records) {
    out.push({
      type: 'record',
      recordId: r.recordId,
      title: r.title,
      demo_id: r.demo_id,
      source_file: r.source_file,
      source_reference: r.source_reference,
      retrievalMethod: r.retrievalMethod,
    });
  }
  return out;
}

function applyMetadataFilter(hits, filters = {}) {
  const active = filters && Object.entries(filters).some(([, v]) => v && v !== 'all');
  if (!active) return { hits, before: hits.length, after: hits.length, applied: false };
  const before = hits.length;
  const filtered = hits.filter(h => {
    const m = h.metadata || {};
    if (filters.domain && filters.domain !== 'all' && m.domain
      && !String(m.domain).toLowerCase().includes(String(filters.domain).toLowerCase())) {
      return false;
    }
    if (filters.section && filters.section !== 'all' && h.section
      && !String(h.section).toLowerCase().includes(String(filters.section).toLowerCase())) {
      return false;
    }
    if (filters.is_number) {
      const blob = `${(h.isNumbers || []).join(' ')} ${m.is_number || ''} ${h.title || ''}`.toUpperCase();
      if (!blob.includes(String(filters.is_number).toUpperCase().replace(/\s+/g, ' '))) return false;
    }
    if (filters.language && filters.language !== 'all' && m.language && m.language !== filters.language) {
      return false;
    }
    return true;
  });
  return { hits: filtered, before, after: filtered.length, applied: true };
}

function formatStageResults(items, method, query = '') {
  return (items || []).map(item => mapChunk(item, method || item.retrievalMethod, query));
}

/**
 * Unified retrieval interface for the agent.
 * Order: exact ID → API/DB → lexical+vector hybrid → evidence selection.
 */
export async function retrieve(query, {
  clusterId,
  topK = 8,
  stage = 'live',
  filters = {},
  history = [],
  contextEntities = {},
  mode = 'hybrid',
  lexicalWeight = 0.55,
  denseWeight = 0.45,
  includeTrace = false,
} = {}) {
  const started = Date.now();
  const methods = [];
  let retrievalType = 'none';
  const records = [];
  let chunks = [];
  let connectorUsed = null;

  const { entities, expanded, identifiers: ids } = extractQueryEntities(query);
  // Only the latest carried identifier, and only when the caller passed context
  // (chat does that for pronoun follow-ups). Never merge a whole session history.
  const lastOf = (val) => {
    const list = (Array.isArray(val) ? val : (val ? [val] : [])).filter(Boolean);
    return list.length ? [list[list.length - 1]] : [];
  };
  if (!ids.isNumbers.length) ids.isNumbers.push(...lastOf(contextEntities.isNumbers));
  if (!ids.qcoIds.length) ids.qcoIds.push(...lastOf(contextEntities.qcoIds));
  if (!ids.cmlIds.length) ids.cmlIds.push(...lastOf(contextEntities.cmlIds));
  ids.hasExactId = Boolean(
    ids.isNumbers.length || ids.qcoIds.length || ids.cmlIds.length
    || ids.huidCodes.length || ids.labIds.length || ids.caseIds.length || ids.appIds.length,
  );

  const exactStage = { status: 'not_used', method: 'exact_identifier', results: [], count: 0, connector: null, error: null };
  const structuredStage = { status: 'not_used', method: 'structured_api', results: [], count: 0, connector: null, error: null };

  const exactHint = connectorForIdentifier(ids);
  if (exactHint) {
    exactStage.status = 'used';
    exactStage.connector = exactHint.connector;
    try {
      const apiData = await executeProbeApi(exactHint.connector, exactHint.token);
      connectorUsed = exactHint.connector;
      methods.push('exact_identifier');
      retrievalType = 'exact_lookup';
      const mapped = mapRecord(apiData, exactHint.connector, 'exact_identifier');
      if (mapped?.length) {
        records.push(...mapped);
        exactStage.results = mapped;
        exactStage.count = mapped.length;
        structuredStage.status = 'used';
        structuredStage.method = exactHint.connector;
        structuredStage.connector = exactHint.connector;
        structuredStage.results = mapped;
        structuredStage.count = mapped.length;
      } else {
        exactStage.status = 'no_match';
        structuredStage.status = 'no_match';
      }
    } catch (err) {
      exactStage.status = 'failed';
      exactStage.error = err.message;
      structuredStage.status = 'failed';
      structuredStage.error = err.message;
      methods.push('exact_identifier_failed');
    }
  }

  const isSynonymQuery = (expanded.expandedTerms?.length || 0) > 0;

  let indexTrace = null;
  let filteredStage = { status: 'not_used', before: 0, after: 0, results: [], filters };
  let rerankedStage = { status: 'not_used', input: 0, output: 0, results: [], method: 'hybrid_weighted' };
  let evidenceStage = { status: 'not_used', input: 0, output: 0, results: [] };
  let anchorStage = { status: 'not_used', rejected: false, reason: null };

  const needsIndex = !records.length || isSynonymQuery
    || /\b(standard|apply|which|what|how|helmet|safety|mandatory|fee|lab|laboratory|active)\b/i.test(query);

  if (needsIndex) {
    indexTrace = searchIndexTraced(clusterId, query, {
      topK,
      stage,
      mode,
      lexicalWeight,
      denseWeight,
    });

    if (indexTrace.lexical.status === 'used') methods.push('tfidf_cosine');
    if (indexTrace.dense.status === 'used') methods.push('hash_trick_dense_384');
    if (indexTrace.combined.status === 'used') methods.push('hybrid_weighted');

    let hits = indexTrace.combined.candidates || [];
    rerankedStage = {
      status: hits.length ? 'used' : 'not_used',
      input: hits.length,
      output: hits.length,
      results: formatStageResults(hits, indexTrace.combined.method, query),
      method: indexTrace.combined.method,
      weights: indexTrace.weights,
    };

    const filterResult = applyMetadataFilter(hits, filters);
    hits = filterResult.hits;
    filteredStage = {
      status: filterResult.applied ? 'used' : (hits.length ? 'skipped' : 'not_used'),
      before: filterResult.before,
      after: filterResult.after,
      results: formatStageResults(hits, indexTrace.combined.method, query),
      filters,
    };

    const evidenceInput = hits.length;
    const filtered = filterRelevantHits(query, hits, { max: topK, expandedTerms: expanded.expandedTerms });
    evidenceStage = {
      status: filtered.length ? 'used' : 'not_used',
      input: evidenceInput,
      output: filtered.length,
      results: formatStageResults(filtered, 'evidence_selection', query),
    };

    if (filtered.length) {
      retrievalType = records.length ? 'hybrid_exact_and_index' : (indexTrace.hybrid ? 'hybrid' : 'lexical_vector');
      chunks = filtered.map(h => mapChunk(h, indexTrace.combined.method, query));
    } else if (!records.length) {
      retrievalType = 'no_result';
    }
  }

  let topScore = chunks[0]?.score || 0;
  // Only regulatory/ID tokens are anchors — not generic long words like "mandatory".
  const anchorTerms = [
    ...(String(query).match(/\bIS\s*\d[\d\s().:-]*/gi) || []),
    ...(String(query).match(/\b[A-Z]{2,6}-DEMO-\d{3}\b/g) || []),
    ...(String(query).match(/\bCM\/L-?\d+\b/gi) || []),
    ...(String(query).match(/\bHUID\s*[A-Z0-9]+\b/gi) || []),
    ...(String(query).match(/\b\d{6,}\b/g) || []),
  ].map((s) => s.toLowerCase().replace(/\s+/g, ''));

  const topBlob = chunks.slice(0, 5)
    .map((c) => `${c.title || ''} ${c.text || ''} ${c.is_number || ''} ${c.record_id || ''} ${c.label || ''}`)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '');

  const anchorMiss = anchorTerms.length > 0 && anchorTerms.every((t) => !topBlob.includes(t));
  // Reject only pure garbage scores, or weak scores where every ID anchor is missing.
  const weakIndexOnly = chunks.length > 0
    && records.length === 0
    && (
      topScore < SCORE_POLICY.evidenceFloor
      || (topScore < 0.10 && anchorMiss)
    );

  if (weakIndexOnly) {
    anchorStage = {
      status: 'used',
      rejected: true,
      reason: topScore < SCORE_POLICY.evidenceFloor ? 'low_score' : 'anchor_term_miss',
      anchorTerms,
    };
    chunks = [];
    topScore = 0;
    retrievalType = 'no_result';
    evidenceStage.output = 0;
    evidenceStage.results = [];
  }

  const qcoInject = await attachQcoAuthoritativeSources(chunks, query);

  const sources = buildSources(chunks, records);
  const hasEvidence = chunks.length > 0 || records.length > 0;
  const confidence = hasEvidence
    ? Math.min(0.95, 0.35 + topScore + (records.length ? 0.25 : 0))
    : 0;

  const answerContext = hasEvidence
    ? {
        summary: chunks[0]?.textPreview || records[0]?.title || null,
        expandedTerms: expanded.expandedTerms,
        expandedQuery: expanded.expandedQuery !== query ? expanded.expandedQuery : undefined,
        recordCount: records.length,
        chunkCount: chunks.length,
        ...(qcoInject?.line ? { authoritativeEnforcement: qcoInject.line } : {}),
      }
    : { message: INSUFFICIENT, expandedTerms: expanded.expandedTerms };

  const indexStatus = getIndexStatus(clusterId);

  const counts = {
    lexical: indexTrace?.lexical?.count ?? 0,
    dense: indexTrace?.dense?.count ?? 0,
    combined: indexTrace?.combined?.count ?? 0,
    filtered: filteredStage.after ?? 0,
    reranked: rerankedStage.output ?? 0,
    evidenceSelection: evidenceStage.output ?? 0,
    finalEvidence: chunks.length + records.length,
    structured: structuredStage.count ?? 0,
    exact: exactStage.count ?? 0,
  };

  const finalEvidence = [
    ...records.map(r => ({
      type: 'record',
      title: r.title,
      recordId: r.recordId,
      score: null,
      retrievalMethod: r.retrievalMethod,
      domain: null,
      section: null,
      is_number: r.is_number,
      demo_id: r.demo_id,
      source_file: r.source_file,
      source_reference: r.source_reference,
      sourceUrl: r.source_reference,
      textPreview: r.title,
      text: JSON.stringify(r.data, null, 2).slice(0, 500),
      provenance: r.provenance,
    })),
    ...chunks.map(c => ({ type: 'chunk', ...c })),
  ];

  const result = {
    query,
    answer_context: answerContext,
    records,
    chunks,
    sources,
    provenance: finalEvidence.map(e => e.provenance),
    confidence,
    retrieval_type: retrievalType,
    methods_used: methods,
    insufficient_evidence: !hasEvidence,
    connector: connectorUsed,
    index: indexStatus,
    hybrid: !!indexTrace?.hybrid,
    stage: indexTrace?.stage || indexStatus.stage,
    latency_ms: Date.now() - started,
    identifiers: ids,
    finalEvidence,
    counts,
  };

  if (includeTrace) {
    result.trace = {
      query,
      strategy: indexTrace?.indexModel || (mode === 'lexical' ? 'tfidf_cosine' : mode === 'dense' ? 'hash_trick_dense_384' : 'hybrid-tfidf-dense-v2'),
      config: {
        topK,
        stage,
        mode,
        lexicalWeight,
        denseWeight,
        filters,
      },
      understanding: {
        query,
        entities: entities.length ? entities : null,
        identifiers: ids.hasExactId ? ids : null,
        expandedTerms: expanded.expandedTerms?.length ? expanded.expandedTerms : null,
        expandedQuery: expanded.expandedQuery !== query ? expanded.expandedQuery : null,
      },
      stages: {
        exact: exactStage,
        structured: structuredStage,
        lexical: indexTrace?.lexical || { status: 'not_used', method: 'tfidf_cosine', candidates: [], count: 0 },
        dense: indexTrace?.dense || { status: 'not_used', method: 'hash_trick_dense_384', candidates: [], count: 0 },
        combined: indexTrace?.combined || { status: 'not_used', method: 'hybrid_weighted', candidates: [], count: 0 },
        metadataFilter: filteredStage,
        reranked: rerankedStage,
        evidenceSelection: evidenceStage,
        anchorGuard: anchorStage,
      },
      counts,
      finalEvidence,
    };
  }

  return result;
}
