import fs from 'fs';
import path from 'path';
import { PATHS } from '../config/paths.js';

export function quarantineDir(clusterId) {
  return path.join(PATHS.dataRoot, clusterId, 'quarantine');
}

export function ensureQuarantineDir(clusterId) {
  const dir = quarantineDir(clusterId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function quarantineRecordPath(clusterId, warehouseItemId) {
  const safe = String(warehouseItemId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(quarantineDir(clusterId), `${safe}.json`);
}

/**
 * Park a failed / unusable record so it never enters chunks/index.
 */
export function writeQuarantineRecord(record, reason = 'quality failed') {
  const dir = ensureQuarantineDir(record.clusterId);
  const payload = {
    ...record,
    quarantine: {
      reason,
      at: new Date().toISOString(),
      lane: 'pre-silver',
    },
  };
  const filePath = quarantineRecordPath(record.clusterId, record.warehouseItemId);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

  const manifestPath = path.join(dir, '_manifest.json');
  let manifest = { clusterId: record.clusterId, items: [] };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      /* reset */
    }
  }
  const id = record.warehouseItemId;
  manifest.items = (manifest.items || []).filter(i => i.warehouseItemId !== id);
  manifest.items.unshift({
    warehouseItemId: id,
    reason,
    at: payload.quarantine.at,
    status: record.quality?.status || 'failed',
  });
  manifest.items = manifest.items.slice(0, 500);
  manifest.updatedAt = payload.quarantine.at;
  manifest.count = manifest.items.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return filePath;
}

export function clearQuarantineEntry(clusterId, warehouseItemId) {
  const p = quarantineRecordPath(clusterId, warehouseItemId);
  if (fs.existsSync(p)) fs.unlinkSync(p);

  const manifestPath = path.join(quarantineDir(clusterId), '_manifest.json');
  if (!fs.existsSync(manifestPath)) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.items = (manifest.items || []).filter(i => i.warehouseItemId !== warehouseItemId);
    manifest.count = manifest.items.length;
    manifest.updatedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch {
    /* ignore */
  }
}
