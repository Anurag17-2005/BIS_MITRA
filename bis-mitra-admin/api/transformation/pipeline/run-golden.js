import fs from 'fs';
import { loadAdminStore, listWarehouseItems, listClusterIds } from '../manifest/warehouse-reader.js';
import { readWarehouseItem } from '../readers/index.js';
import { applyNormalization } from '../techniques/normalization/index.js';
import { applyEnrichment } from '../techniques/enrichment/index.js';
import { applyQuality } from '../techniques/quality/index.js';
import { applyStandardization } from '../techniques/standardization/index.js';
import { applyProvenance } from '../techniques/provenance/index.js';
import { createDedupRegistry, computeContentHash } from '../techniques/deduplication/index.js';
import { writeGoldenRecord, writeGoldenManifest } from '../writers/golden-writer.js';
import { writeQuarantineRecord, clearQuarantineEntry } from '../writers/quarantine-writer.js';
import { goldenRecordPath } from '../config/paths.js';

/**
 * Process one warehouse item through the golden pipeline.
 */
export async function processWarehouseItem(item, dedupRegistry) {
  const raw = await readWarehouseItem(item);
  let draft = { ...raw, isNumbers: [], quality: { status: 'ok', warnings: [] } };

  draft = applyNormalization(draft);
  const rawTextForDedup = (draft.text || '').trim();

  draft = applyEnrichment(item, draft);
  draft = applyQuality(item, draft);

  const statusBeforeDedup = draft.quality?.status || 'ok';
  let contentHash = null;
  let duplicateOf = null;

  if (statusBeforeDedup !== 'failed') {
    contentHash = rawTextForDedup.length >= 20
      ? computeContentHash(rawTextForDedup)
      : (item.catalog?.content_sha256 || computeContentHash(`artifact:${item.id}`));
    duplicateOf = dedupRegistry.register(contentHash, item.id);

    if (duplicateOf && duplicateOf !== item.id) {
      draft.quality = {
        status: 'duplicate',
        warnings: [...(draft.quality?.warnings || []), `duplicate of ${duplicateOf}`],
      };
    }
  }

  let record = applyStandardization(item, draft, {
    contentHash,
    duplicateOf: duplicateOf && duplicateOf !== item.id ? duplicateOf : null,
  });
  record = applyProvenance(item, record);

  const status = record.quality?.status || 'ok';
  if (status === 'failed') {
    const reason = (record.quality?.warnings || []).join('; ') || 'quality failed';
    const filePath = writeQuarantineRecord(record, reason);
    const gp = goldenRecordPath(record.clusterId, record.warehouseItemId);
    if (fs.existsSync(gp)) fs.unlinkSync(gp);
    return { record, filePath, quarantined: true };
  }

  clearQuarantineEntry(record.clusterId, record.warehouseItemId);
  const filePath = writeGoldenRecord(record);
  return { record, filePath, quarantined: false };
}

/**
 * Build golden layer for one cluster from admin warehouse.
 */
export async function runGoldenForCluster(clusterId, store) {
  const items = listWarehouseItems(store, { clusterId });
  const dedup = createDedupRegistry();
  const results = [];

  for (const item of items) {
    try {
      const out = await processWarehouseItem(item, dedup);
      results.push({
        warehouseItemId: item.id,
        status: out.quarantined ? 'quarantined' : (out.record.quality?.status || 'ok'),
        filePath: out.filePath,
        duplicateOf: out.record.duplicateOf,
        quarantined: !!out.quarantined,
      });
    } catch (err) {
      results.push({
        warehouseItemId: item.id,
        status: 'failed',
        error: err.message,
      });
    }
  }

  const manifest = {
    clusterId,
    generatedAt: new Date().toISOString(),
    pipeline: 'golden-v1',
    warehouseItemCount: items.length,
    goldenRecordCount: results.filter(r => r.status !== 'failed' && r.status !== 'quarantined').length,
    byStatus: countBy(results, 'status'),
    bySection: countBySection(items, results),
    contentHashes: dedup.snapshot(),
    items: results,
  };

  writeGoldenManifest(clusterId, manifest);
  return manifest;
}

/**
 * Run golden pipeline for all clusters with warehouse data.
 */
export async function runGoldenPipeline({ clusterId, all = false } = {}) {
  const store = loadAdminStore();
  const clusterIds = all
    ? listClusterIds(store).filter(id => listWarehouseItems(store, { clusterId: id }).length > 0)
    : [clusterId].filter(Boolean);

  if (clusterIds.length === 0) {
    throw new Error('No cluster specified. Use --cluster <id> or --all');
  }

  const manifests = [];
  for (const cid of clusterIds) {
    manifests.push(await runGoldenForCluster(cid, store));
  }
  return manifests;
}

function countBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function countBySection(items, results) {
  const byId = new Map(items.map(i => [i.id, i.domain]));
  const out = {};
  for (const r of results) {
    const sec = byId.get(r.warehouseItemId) || 'unknown';
    out[sec] = (out[sec] || 0) + 1;
  }
  return out;
}
