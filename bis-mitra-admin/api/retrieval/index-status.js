import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveClusterId } from './search-knowledge.js';
import { PATHS } from '../core/config/paths.js';
import { isLfsPointer, readJsonFileSafe } from '../core/read-json-file.js';

const CHUNKS_ROOT = process.env.TRANSFORM_DATA_PATH || PATHS.dataRoot;

function indexDir(clusterId, stage) {
  return path.join(CHUNKS_ROOT, clusterId, 'index', stage);
}

/**
 * Index health snapshot for admin retrieval proof screen.
 */
export function getIndexStatus(clusterId) {
  const resolved = resolveClusterId(clusterId);
  if (!resolved) {
    return { status: 'UNAVAILABLE', clusterId: null, message: 'No published cluster' };
  }

  const liveManifestPath = path.join(indexDir(resolved, 'live'), '_manifest.json');
  const draftManifestPath = path.join(indexDir(resolved, 'draft'), '_manifest.json');
  const liveIndexPath = path.join(indexDir(resolved, 'live'), 'search-index.json');
  const draftIndexPath = path.join(indexDir(resolved, 'draft'), 'search-index.json');

  let hasLive = fs.existsSync(liveIndexPath);
  let hasDraft = fs.existsSync(draftIndexPath);
  if (hasLive && isLfsPointer(fs.readFileSync(liveIndexPath, 'utf8').slice(0, 80))) {
    hasLive = false;
  }
  const stage = hasLive ? 'live' : (hasDraft ? 'draft' : null);

  let manifest = null;
  if (stage === 'live' && fs.existsSync(liveManifestPath)) {
    manifest = readJsonFileSafe(liveManifestPath);
  } else if (fs.existsSync(draftManifestPath)) {
    manifest = readJsonFileSafe(draftManifestPath);
  }
  if (manifest?.__lfsPointer) manifest = null;

  const chunksPath = path.join(CHUNKS_ROOT, resolved, 'chunks', '_manifest.json');
  let chunkCount = manifest?.chunkCount ?? 0;
  if (fs.existsSync(chunksPath)) {
    try {
      const cm = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
      chunkCount = cm.count ?? chunkCount;
    } catch { /* ignore */ }
  }

  return {
    status: stage === 'live' ? 'LIVE' : (stage ? 'DRAFT' : 'NOT_BUILT'),
    clusterId: resolved,
    stage,
    indexVersion: manifest?.model || null,
    totalChunks: chunkCount,
    indexedChunks: manifest?.chunkCount ?? 0,
    vocabularySize: manifest?.vocabularySize ?? null,
    builtAt: manifest?.builtAt || null,
    promotedAt: manifest?.promotedAt || null,
    hybrid: manifest?.model?.includes('hybrid') ?? true,
  };
}
