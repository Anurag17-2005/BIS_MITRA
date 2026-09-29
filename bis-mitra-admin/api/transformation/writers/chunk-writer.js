import fs from 'fs';
import path from 'path';
import { chunksDir } from '../config/paths.js';

export function ensureChunksDir(clusterId) {
  const dir = chunksDir(clusterId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeChunkManifest(clusterId, manifest) {
  const dir = ensureChunksDir(clusterId);
  const filePath = path.join(dir, '_manifest.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
  return filePath;
}

function assertChunkProvenance(chunk, sourceId) {
  const meta = chunk.metadata || {};
  const hasPdf = !!(meta.source_file || chunk.citation?.source_url?.match(/\.pdf/i));
  const hasUrl = !!(meta.source_url || chunk.citation?.source_url);
  const hasDomain = !!(meta.domain || chunk.section);
  if (!hasPdf && !hasUrl) {
    console.warn(
      `[chunk-writer] PROVENANCE MISSING: chunk from "${sourceId}" has no source_file or source_url.`
      + ' This chunk may show a weak source card. Add catalog.canonical_url to the warehouse item.',
    );
    chunk.metadata = { ...meta, provenance_missing: true };
  }
  if (!hasDomain) {
    console.warn(`[chunk-writer] DOMAIN MISSING: chunk from "${sourceId}" has no domain or section.`);
  }
  return chunk;
}

export function writeChunksBundle(clusterId, chunks) {
  const dir = ensureChunksDir(clusterId);
  const validated = (chunks || []).map((c) => assertChunkProvenance(c, c.warehouseItemId || c.id || 'unknown'));
  const filePath = path.join(dir, '_chunks.json');
  fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
  return filePath;
}
