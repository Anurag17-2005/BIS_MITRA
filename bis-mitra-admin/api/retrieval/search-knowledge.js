import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchIndex } from '../transformation/pipeline/run-index.js';
import { PATHS } from '../core/config/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNKS_ROOT = process.env.TRANSFORM_DATA_PATH || PATHS.dataRoot;
const ADMIN_STORE = PATHS.adminStore;

export function resolveClusterId(explicitId) {
  if (explicitId) return explicitId;
  if (!fs.existsSync(ADMIN_STORE)) return null;
  const store = JSON.parse(fs.readFileSync(ADMIN_STORE, 'utf8'));
  return store.clusters?.find(c => c.published)?.id || null;
}

function loadChunkFull(clusterId, chunkId) {
  const file = path.join(CHUNKS_ROOT, clusterId, 'chunks', '_chunks.json');
  if (!fs.existsSync(file)) return null;
  const chunks = JSON.parse(fs.readFileSync(file, 'utf8'));
  return chunks.find(c => c.id === chunkId) || null;
}

/**
 * Search the published knowledge index for a cluster (live, then draft).
 */
export function searchKnowledge(clusterId, query, { topK = 5, stage = 'live' } = {}) {
  const resolved = resolveClusterId(clusterId);
  if (!resolved) {
    return { query, stage, resultCount: 0, results: [], message: 'No published cluster' };
  }
  const result = searchIndex(resolved, query, { topK, stage });
  const results = (result.results || []).map(hit => {
    const full = loadChunkFull(resolved, hit.chunkId);
    return {
      ...hit,
      text: full?.text || hit.textPreview,
      citation: full?.citation || hit.citation || null,
      metadata: full?.metadata || hit.metadata || null,
      isNumbers: full?.isNumbers || [],
      layman_synonyms: full?.layman_synonyms || hit.layman_synonyms || [],
    };
  });
  return { ...result, clusterId: resolved, results };
}
