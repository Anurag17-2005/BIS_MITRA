import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C2_CLUSTER_ID } from '../api/clusters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_ROOT = path.join(__dirname, '..');
export const SEED_CLUSTER_ID = C2_CLUSTER_ID;

export const PATHS = {
  adminRoot: ADMIN_ROOT,
  liveStore: path.join(ADMIN_ROOT, 'data', 'admin-store.json'),
  liveIndexes: path.join(ADMIN_ROOT, 'data', 'indexes'),
  liveUploads: path.join(ADMIN_ROOT, 'data', 'uploads'),
  seedRoot: path.join(ADMIN_ROOT, 'data', 'render-seed'),
  seedStore: path.join(ADMIN_ROOT, 'data', 'render-seed', 'admin-store.json'),
  seedManifest: path.join(ADMIN_ROOT, 'data', 'render-seed', 'MANIFEST.json'),
};

export function seedIndexesDir(clusterId = SEED_CLUSTER_ID) {
  return path.join(PATHS.seedRoot, 'indexes', clusterId);
}

export function seedUploadsDir(clusterId = SEED_CLUSTER_ID) {
  return path.join(PATHS.seedRoot, 'uploads', clusterId);
}

export function liveIndexLiveSearch(clusterId = SEED_CLUSTER_ID) {
  return path.join(PATHS.liveIndexes, clusterId, 'index', 'live', 'search-index.json');
}

export function seedIndexLiveSearch(clusterId = SEED_CLUSTER_ID) {
  return path.join(seedIndexesDir(clusterId), 'index', 'live', 'search-index.json');
}

export function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

export function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, name.name);
    const to = path.join(dest, name.name);
    if (name.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
  return true;
}
