import fs from 'fs';
import path from 'path';
import { goldenDir, goldenRecordPath } from '../config/paths.js';

export function ensureGoldenDir(clusterId) {
  const dir = goldenDir(clusterId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeGoldenRecord(record) {
  const filePath = goldenRecordPath(record.clusterId, record.warehouseItemId);
  ensureGoldenDir(record.clusterId);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  return filePath;
}

export function writeGoldenManifest(clusterId, manifest) {
  const dir = ensureGoldenDir(clusterId);
  const filePath = path.join(dir, '_manifest.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
  return filePath;
}
