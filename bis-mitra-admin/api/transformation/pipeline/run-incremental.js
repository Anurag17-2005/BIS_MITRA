import fs from 'fs';
import path from 'path';
import { goldenDir, goldenRecordPath } from '../config/paths.js';
import { loadAdminStore, listWarehouseItems } from '../manifest/warehouse-reader.js';
import { processWarehouseItem } from './run-golden.js';
import { createDedupRegistry } from '../techniques/deduplication/index.js';
import { writeGoldenManifest } from '../writers/golden-writer.js';
import { runChunksForCluster } from './run-chunks.js';
import { runIndexForCluster } from './run-index.js';

function readGoldenSha(clusterId, warehouseItemId) {
  const p = goldenRecordPath(clusterId, warehouseItemId);
  if (!fs.existsSync(p)) return null;
  try {
    const g = JSON.parse(fs.readFileSync(p, 'utf8'));
    return g.catalog?.content_sha256 || g.contentHash || null;
  } catch {
    return null;
  }
}

export function listChangedWarehouseItems(clusterId, store = null) {
  const adminStore = store || loadAdminStore();
  const items = listWarehouseItems(adminStore, { clusterId });
  const changed = [];
  for (const item of items) {
    const whSha = item.catalog?.content_sha256;
    const gSha = readGoldenSha(clusterId, item.id);
    if (!gSha || (whSha && whSha !== gSha)) changed.push(item.id);
  }
  return changed;
}

export async function runGoldenForItems(clusterId, warehouseItemIds, store = null) {
  const adminStore = store || loadAdminStore();
  const items = listWarehouseItems(adminStore, { clusterId })
    .filter(i => warehouseItemIds.includes(i.id));
  const dedup = createDedupRegistry();
  const results = [];

  for (const item of items) {
    try {
      const out = await processWarehouseItem(item, dedup);
      results.push({
        warehouseItemId: item.id,
        status: out.record.quality?.status || 'ok',
        duplicateOf: out.record.duplicateOf,
      });
    } catch (err) {
      results.push({ warehouseItemId: item.id, status: 'failed', error: err.message });
    }
  }

  const manifestPath = path.join(goldenDir(clusterId), '_manifest.json');
  let manifest = { clusterId, pipeline: 'golden-v1', items: [] };
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  manifest.generatedAt = new Date().toISOString();
  manifest.incrementalAt = new Date().toISOString();
  manifest.lastIncremental = results;
  manifest.goldenRecordCount = fs.readdirSync(goldenDir(clusterId))
    .filter(f => f.endsWith('.json') && f !== '_manifest.json').length;
  writeGoldenManifest(clusterId, manifest);

  return { processed: results.length, results };
}

export async function runIncrementalTransform(clusterId, { warehouseItemIds = null } = {}) {
  const store = loadAdminStore();
  const changedItemIds = warehouseItemIds?.length
    ? warehouseItemIds
    : listChangedWarehouseItems(clusterId, store);

  let golden = null;
  if (changedItemIds.length) {
    golden = await runGoldenForItems(clusterId, changedItemIds, store);
  }

  const chunks = runChunksForCluster(clusterId);
  const index = runIndexForCluster(clusterId, 'draft');

  return {
    clusterId,
    changedItemIds,
    golden,
    chunks,
    index,
    skippedGolden: !changedItemIds.length,
  };
}
