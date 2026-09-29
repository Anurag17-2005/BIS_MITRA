import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ROOT = path.join(__dirname, '..', '..', '..');
const REPO = path.join(ADMIN_ROOT, '..');

const indexesData = path.join(ADMIN_ROOT, 'data', 'indexes');

function resolveDataRoot() {
  return process.env.TRANSFORM_DATA_ROOT || indexesData;
}

export const PATHS = {
  transformRoot: ADMIN_ROOT,
  dataRoot: resolveDataRoot(),
  adminStore: process.env.ADMIN_STORE_PATH
    || path.join(ADMIN_ROOT, 'data', 'admin-store.json'),
  adminUploads: process.env.ADMIN_UPLOADS_PATH
    || path.join(ADMIN_ROOT, 'data', 'uploads'),
  cloneFiles: process.env.CLONE_FILES_PATH
    || path.join(REPO, 'bis-clone', 'public', 'files'),
  knowledgePdfs: process.env.KNOWLEDGE_PDFS_PATH
    || path.join(REPO, 'bis-clone', 'data', 'knowledge', 'pdfs'),
  cloneFetched: process.env.CLONE_FETCHED_PATH
    || path.join(REPO, 'bis-clone', 'data', 'fetched'),
};

export function goldenDir(clusterId) {
  return path.join(PATHS.dataRoot, clusterId, 'golden');
}

export function goldenRecordPath(clusterId, warehouseItemId) {
  const safe = String(warehouseItemId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(goldenDir(clusterId), `${safe}.json`);
}

export function chunksDir(clusterId) {
  return path.join(PATHS.dataRoot, clusterId, 'chunks');
}

export function indexDir(clusterId, stage = 'draft') {
  return path.join(PATHS.dataRoot, clusterId, 'index', stage);
}
