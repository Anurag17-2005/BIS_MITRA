import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexDir } from '../core/config/paths.js';
import { tokenize, termFrequency, vectorize, cosineSimilarity } from './index/tfidf.js';
import { embedText, denseSimilarity, DENSE_DIM } from './index/dense.js';
import { expandQueryTerms } from './regulatory/synonym-expander.js';
import { resolveClusterId } from './search-knowledge.js';
import { PATHS } from '../core/config/paths.js';
import { SCORE_POLICY } from './score-policy.js';

const CHUNKS_ROOT = process.env.TRANSFORM_DATA_PATH || PATHS.dataRoot;

const LEXICAL_METHOD = 'tfidf_cosine';
const DENSE_METHOD = 'hash_trick_dense_384';
const HYBRID_METHOD = 'hybrid_weighted';

function loadChunkFull(clusterId, chunkId) {
  const file = path.join(CHUNKS_ROOT, clusterId, 'chunks', '_chunks.json');
  if (!fs.existsSync(file)) return null;
  const chunks = JSON.parse(fs.readFileSync(file, 'utf8'));
  return chunks.find(c => c.id === chunkId) || null;
}

function resolveIndexPath(clusterId, stage) {
  const livePath = path.join(indexDir(clusterId, 'live'), 'search-index.json');
  const draftPath = path.join(indexDir(clusterId, 'draft'), 'search-index.json');
  if (stage === 'draft') {
    return { path: draftPath, stage: 'draft' };
  }
  if (fs.existsSync(livePath)) {
    return { path: livePath, stage: 'live' };
  }
  return { path: draftPath, stage: 'draft' };
}

function cleanDomain(raw) {
  if (!raw) return null;
  return String(raw).replace(/^chunk:/i, '').trim() || null;
}

function toHit(e, scores, method) {
  const meta = e.metadata || {};
  // Prefer section (already "standards") over sectionTag ("chunk:standards").
  const domain = cleanDomain(meta.domain || e.section || e.sectionTag);
  return {
    chunkId: e.chunkId,
    recordId: e.warehouseItemId || e.goldenId || meta.demo_id || null,
    warehouseItemId: e.warehouseItemId,
    goldenId: e.goldenId,
    title: e.title,
    section: e.section,
    sectionTag: e.sectionTag,
    domain,
    textPreview: e.textPreview,
    citation: e.citation,
    metadata: meta,
    layman_synonyms: e.layman_synonyms,
    score: scores.combined ?? scores.lexical ?? scores.dense ?? 0,
    scoreLexical: scores.lexical ?? null,
    scoreDense: scores.dense ?? null,
    retrievalMethod: method,
    is_number: meta.is_number || null,
    demo_id: meta.demo_id || null,
    source_file: meta.source_file || null,
    source_reference: meta.source_reference || meta.source_url || null,
    sourceUrl: meta.source_url || meta.source_reference || null,
  };
}

function hydrateHits(clusterId, hits) {
  return hits.map(h => {
    const full = loadChunkFull(clusterId, h.chunkId);
    return {
      ...h,
      text: full?.text || h.textPreview,
      isNumbers: full?.isNumbers || [],
      metadata: full?.metadata || h.metadata || null,
      citation: full?.citation || h.citation || null,
      chunkIndex: full?.chunkIndex ?? h.chunkIndex ?? null,
      charStart: full?.charStart ?? null,
      warehouseItemId: full?.warehouseItemId || h.warehouseItemId || null,
    };
  });
}

function topCandidates(scored, topK, minScore = SCORE_POLICY.candidateFloor) {
  return scored
    .filter(r => r.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Index search with per-stage trace (same scoring as run-index.js searchIndex).
 */
export function searchIndexTraced(clusterId, query, {
  topK = 8,
  stage = 'live',
  mode = 'hybrid',
  lexicalWeight = 0.55,
  denseWeight = 0.45,
} = {}) {
  const resolved = resolveClusterId(clusterId);
  if (!resolved) {
    return {
      clusterId: null,
      stage,
      expanded: expandQueryTerms(query),
      lexical: { status: 'not_used', method: LEXICAL_METHOD, candidates: [], count: 0 },
      dense: { status: 'not_used', method: DENSE_METHOD, candidates: [], count: 0 },
      combined: { status: 'not_used', method: HYBRID_METHOD, candidates: [], count: 0 },
      hybrid: false,
      indexModel: null,
    };
  }

  const { path: indexPath, stage: searchStage } = resolveIndexPath(resolved, stage);
  const expanded = expandQueryTerms(query);
  const qText = expanded.expandedQuery;

  if (!fs.existsSync(indexPath)) {
    return {
      clusterId: resolved,
      stage: searchStage,
      expanded,
      lexical: { status: 'not_used', method: LEXICAL_METHOD, candidates: [], count: 0, message: 'No index built yet' },
      dense: { status: 'not_used', method: DENSE_METHOD, candidates: [], count: 0 },
      combined: { status: 'not_used', method: HYBRID_METHOD, candidates: [], count: 0 },
      hybrid: false,
      indexModel: null,
    };
  }

  const { idf, entries, hybrid: indexHybrid } = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const qVec = vectorize(termFrequency(tokenize(qText)), idf);
  const qDense = embedText(qText);

  const useLexical = mode !== 'dense';
  const useDense = mode !== 'lexical' && (indexHybrid || entries[0]?.dense);
  const lw = mode === 'lexical' ? 1 : (mode === 'dense' ? 0 : lexicalWeight);
  const dw = mode === 'dense' ? 1 : (mode === 'lexical' ? 0 : denseWeight);

  const poolK = topK * 2;
  const allScored = entries.map(e => {
    const lexical = useLexical ? cosineSimilarity(qVec, e.vector || {}) : 0;
    const dense = useDense && e.dense ? denseSimilarity(qDense, e.dense) : 0;
    const combined = useLexical && useDense
      ? (lw * lexical) + (dw * dense)
      : (useDense ? dense : lexical);
    return { entry: e, lexical, dense, combined };
  });

  const lexicalHits = topCandidates(
    allScored.map(s => ({ ...toHit(s.entry, { lexical: s.lexical, combined: s.lexical }, LEXICAL_METHOD), score: s.lexical })),
    poolK,
  );
  const denseHits = useDense
    ? topCandidates(
      allScored.map(s => ({ ...toHit(s.entry, { dense: s.dense, combined: s.dense }, DENSE_METHOD), score: s.dense })),
      poolK,
    )
    : [];

  const combinedHits = topCandidates(
    allScored.map(s => toHit(s.entry, { lexical: s.lexical, dense: s.dense, combined: s.combined }, HYBRID_METHOD)),
    poolK,
  );

  return {
    clusterId: resolved,
    stage: searchStage,
    expanded,
    hybrid: !!(indexHybrid || entries[0]?.dense) && mode === 'hybrid',
    indexModel: 'hybrid-tfidf-dense-v2',
    denseDim: DENSE_DIM,
    weights: { lexical: lw, dense: dw, mode },
    lexical: {
      status: useLexical ? 'used' : 'not_used',
      method: LEXICAL_METHOD,
      candidates: hydrateHits(resolved, lexicalHits),
      count: lexicalHits.length,
    },
    dense: {
      status: useDense ? 'used' : 'not_used',
      method: DENSE_METHOD,
      candidates: hydrateHits(resolved, denseHits),
      count: denseHits.length,
    },
    combined: {
      status: (useLexical || useDense) ? 'used' : 'not_used',
      method: mode === 'hybrid' ? HYBRID_METHOD : (mode === 'lexical' ? LEXICAL_METHOD : DENSE_METHOD),
      candidates: hydrateHits(resolved, combinedHits),
      count: combinedHits.length,
      weights: { lexical: lw, dense: dw },
    },
  };
}
