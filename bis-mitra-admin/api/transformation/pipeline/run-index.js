import fs from 'fs';
import path from 'path';
import { chunksDir, indexDir, PATHS } from '../config/paths.js';
import { tokenize, termFrequency, buildIdf, vectorize, cosineSimilarity } from '../../retrieval/index/tfidf.js';
import { embedText, denseSimilarity, DENSE_DIM } from '../../retrieval/index/dense.js';
import { expandQueryTerms } from '../../retrieval/regulatory/synonym-expander.js';

function loadChunks(clusterId) {
  const file = path.join(chunksDir(clusterId), '_chunks.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildSearchIndex(clusterId, chunks, stage = 'draft') {
  const tokenized = chunks.map(c => {
    const syn = (c.layman_synonyms || []).join(' ');
    const metaBits = [
      c.metadata?.mandatory_status,
      c.metadata?.certification_scheme,
      c.metadata?.clause_path,
      c.metadata?.citation_anchor,
      ...(c.isNumbers || []),
    ].filter(Boolean).join(' ');
    const provenanceBits = [
      String(c.metadata?.source_type || '').replace(/_portal$/, ''),
      c.metadata?.source_url?.split('/').filter(Boolean).pop(),
      String(c.metadata?.domain || c.section || '').replace(/^chunk:/i, ''),
    ].filter(Boolean).join(' ');
    const bag = `${c.title || ''} ${c.text} ${syn} ${metaBits} ${provenanceBits}`;
    return { chunk: c, tokens: tokenize(bag), bag };
  });
  const idf = buildIdf(tokenized.map(t => t.tokens));
  const entries = tokenized.map(({ chunk, tokens, bag }) => ({
    chunkId: chunk.id,
    warehouseItemId: chunk.warehouseItemId,
    goldenId: chunk.goldenId,
    section: chunk.section,
    sectionTag: chunk.sectionTag,
    title: chunk.title,
    textPreview: chunk.text.slice(0, 280),
    citation: chunk.citation || null,
    metadata: chunk.metadata || null,
    layman_synonyms: chunk.layman_synonyms || [],
    vector: vectorize(termFrequency(tokens), idf),
    dense: embedText(bag),
  }));

  const dir = indexDir(clusterId, stage);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'search-index.json'), JSON.stringify({ idf, entries, hybrid: true, denseDim: DENSE_DIM }));

  const manifest = {
    clusterId,
    stage,
    model: 'hybrid-tfidf-dense-v2',
    dimensions: 'sparse-vocabulary+dense-384',
    vocabularySize: Object.keys(idf).length,
    denseDim: DENSE_DIM,
    chunkCount: entries.length,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function runIndexForCluster(clusterId, stage = 'draft') {
  const chunks = loadChunks(clusterId);
  if (!chunks.length) {
    throw new Error(`No chunks for cluster ${clusterId}. Run chunks pipeline first.`);
  }
  return buildSearchIndex(clusterId, chunks, stage);
}

export function searchIndex(clusterId, query, { topK = 5, stage = 'live' } = {}) {
  const livePath = path.join(indexDir(clusterId, 'live'), 'search-index.json');
  const draftPath = path.join(indexDir(clusterId, 'draft'), 'search-index.json');
  let indexPath;
  let searchStage;
  if (stage === 'draft') {
    indexPath = draftPath;
    searchStage = 'draft';
  } else if (stage === 'live') {
    indexPath = fs.existsSync(livePath) ? livePath : draftPath;
    searchStage = indexPath.includes('/live/') ? 'live' : 'draft';
  } else {
    indexPath = fs.existsSync(livePath) ? livePath : draftPath;
    searchStage = indexPath.includes('/live/') ? 'live' : 'draft';
  }
  if (!fs.existsSync(indexPath)) {
    return { query, stage: searchStage, results: [], message: 'No index built yet' };
  }

  const { idf, entries, hybrid } = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const expanded = expandQueryTerms(query);
  const qText = expanded.expandedQuery;
  const qVec = vectorize(termFrequency(tokenize(qText)), idf);
  const qDense = embedText(qText);
  const lexicalWeight = 0.55;
  const denseWeight = 0.45;

  const scored = entries
    .map(e => {
      const lexical = cosineSimilarity(qVec, e.vector || {});
      const dense = e.dense ? denseSimilarity(qDense, e.dense) : 0;
      const score = hybrid || e.dense
        ? (lexicalWeight * lexical) + (denseWeight * dense)
        : lexical;
      return {
        chunkId: e.chunkId,
        warehouseItemId: e.warehouseItemId,
        section: e.section,
        sectionTag: e.sectionTag,
        title: e.title,
        textPreview: e.textPreview,
        citation: e.citation,
        metadata: e.metadata,
        layman_synonyms: e.layman_synonyms,
        score,
        scoreLexical: lexical,
        scoreDense: dense,
      };
    })
    .filter(r => r.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    query,
    expandedQuery: expanded.expandedQuery !== query ? expanded.expandedQuery : undefined,
    expandedTerms: expanded.expandedTerms,
    stage: searchStage,
    hybrid: !!(hybrid || entries[0]?.dense),
    resultCount: scored.length,
    results: scored,
  };
}

export function promoteIndexToLive(clusterId) {
  const draft = indexDir(clusterId, 'draft');
  const live = indexDir(clusterId, 'live');
  if (!fs.existsSync(path.join(draft, 'search-index.json'))) {
    throw new Error(`No draft index for ${clusterId}`);
  }
  fs.mkdirSync(live, { recursive: true });
  for (const f of fs.readdirSync(draft)) {
    fs.copyFileSync(path.join(draft, f), path.join(live, f));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(live, '_manifest.json'), 'utf8'));
  manifest.stage = 'live';
  manifest.promotedAt = new Date().toISOString();
  fs.writeFileSync(path.join(live, '_manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function runIndexPipeline({ clusterId, all = false } = {}) {
  let ids = clusterId ? [clusterId] : [];
  if (all && fs.existsSync(PATHS.dataRoot)) {
    ids = fs.readdirSync(PATHS.dataRoot).filter(d =>
      fs.existsSync(path.join(PATHS.dataRoot, d, 'chunks', '_manifest.json'))
    );
  }
  if (!ids.length) throw new Error('No cluster with chunks found');
  return ids.map(id => runIndexForCluster(id, 'draft'));
}
