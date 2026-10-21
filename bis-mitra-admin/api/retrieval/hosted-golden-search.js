import fs from 'fs';
import path from 'path';
import { goldenDir } from '../transformation/config/paths.js';
import { expandQueryTerms } from './regulatory/synonym-expander.js';
import { tokenize } from './index/tfidf.js';
import { SCORE_POLICY } from './score-policy.js';

const LEXICAL_METHOD = 'hosted_golden_scan';

function scoreText(text, terms) {
  const lower = String(text || '').toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t || t.length < 2) continue;
    const n = lower.split(t).length - 1;
    if (n > 0) score += n * (t.length >= 6 ? 1.2 : 1);
  }
  return score;
}

/**
 * RAM-safe retrieval when full search-index.json cannot be loaded on hosted deploys.
 * Scans golden JSON records (text + title) for query term overlap.
 */
export function searchGoldenHostedFallback(clusterId, query, { topK = 8 } = {}) {
  const dir = goldenDir(clusterId);
  if (!fs.existsSync(dir)) {
    return { hits: [], method: LEXICAL_METHOD, message: 'No golden directory' };
  }

  const expanded = expandQueryTerms(query);
  const terms = [
    ...tokenize(String(query || '')),
    ...tokenize(expanded.expandedQuery || ''),
    ...(expanded.boostTerms || []),
    ...(expanded.translatedTerms || []),
  ].map(t => t.toLowerCase()).filter(t => t.length >= 2);
  const uniqueTerms = [...new Set(terms)];
  if (!uniqueTerms.length) {
    return { hits: [], method: LEXICAL_METHOD, message: 'Empty query' };
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_manifest.json');
  const scored = [];

  for (const file of files) {
    let g;
    try {
      g = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      continue;
    }
    if (g.quality?.status === 'duplicate' || g.quarantined) continue;
    const bag = `${g.title || ''} ${(g.text || '').slice(0, 24000)}`;
    const score = scoreText(bag, uniqueTerms);
    if (score <= 0) continue;
    const warehouseItemId = g.warehouseItemId || file.replace(/\.json$/, '');
    scored.push({
      chunkId: `hosted-golden:${warehouseItemId}`,
      warehouseItemId,
      goldenId: g.id || warehouseItemId,
      title: g.title || warehouseItemId,
      section: g.section || null,
      sectionTag: g.sectionTag || null,
      domain: g.section || null,
      textPreview: (g.text || '').slice(0, 280),
      text: (g.text || '').slice(0, 8000),
      citation: g.citation || null,
      metadata: {
        ...(g.metadata || {}),
        source_file: g.source_file || g.metadata?.source_file || null,
      },
      score,
      scoreLexical: score,
      scoreDense: null,
      retrievalMethod: LEXICAL_METHOD,
      source_file: g.source_file || g.metadata?.source_file || null,
      source_reference: g.metadata?.source_reference || null,
      sourceUrl: g.metadata?.source_url || null,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const minScore = SCORE_POLICY.candidateFloor || 0.01;
  const hits = scored.filter(h => h.score >= minScore).slice(0, topK);
  return {
    hits,
    method: LEXICAL_METHOD,
    expanded,
    scannedFiles: files.length,
    message: hits.length ? `Hosted golden scan (${hits.length} hits)` : 'No golden matches',
  };
}
