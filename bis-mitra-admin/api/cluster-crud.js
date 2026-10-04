import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPlansForCluster } from './plan-templates.js';
import {
  RESERVED_CLUSTER_IDS,
  clusterCanClearData,
  clusterCanDelete,
  clusterCanRename,
} from './clusters.js';
import { clearTransformData } from './transformation/service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'data', 'uploads');

function slugify(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'cluster';
}

function uniqueClusterId(store, baseSlug) {
  let id = baseSlug;
  let n = 2;
  while (store.clusters.some(c => c.id === id) || RESERVED_CLUSTER_IDS.has(id)) {
    id = `${baseSlug}-${n}`;
    n += 1;
  }
  return id;
}

function removeUploadsDir(clusterId) {
  const dir = path.join(UPLOADS_ROOT, clusterId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function createCluster(store, { name, description = '' }) {
  if (!name?.trim()) {
    throw Object.assign(new Error('name required'), { status: 400 });
  }
  const slug = slugify(name);
  const id = uniqueClusterId(store, slug);
  if (RESERVED_CLUSTER_IDS.has(id)) {
    throw Object.assign(new Error('Cluster id is reserved'), { status: 400 });
  }

  const cluster = {
    id,
    name: name.trim(),
    description: description?.trim() || '',
    published: false,
    secured: false,
    deletable: true,
    renamable: true,
    fileCount: 0,
  };

  store.clusters.push(cluster);
  store.plans.push(...buildPlansForCluster(id));
  return cluster;
}

export function renameCluster(store, clusterId, { name, description }) {
  const cluster = store.clusters.find(c => c.id === clusterId);
  if (!cluster) {
    throw Object.assign(new Error('Cluster not found'), { status: 404 });
  }
  if (!clusterCanRename(cluster)) {
    throw Object.assign(new Error('Cluster cannot be renamed'), { status: 403 });
  }
  if (name !== undefined) {
    if (!String(name).trim()) {
      throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    }
    cluster.name = String(name).trim();
  }
  if (description !== undefined) {
    cluster.description = String(description).trim();
  }
  return cluster;
}

export function deleteCluster(store, clusterId) {
  const cluster = store.clusters.find(c => c.id === clusterId);
  if (!cluster) {
    throw Object.assign(new Error('Cluster not found'), { status: 404 });
  }
  if (!clusterCanDelete(cluster)) {
    throw Object.assign(new Error('Cluster cannot be deleted'), { status: 403 });
  }

  store.clusters = store.clusters.filter(c => c.id !== clusterId);
  const planIds = new Set(
    store.plans.filter(p => p.clusterId === clusterId).map(p => p.id)
  );
  store.plans = store.plans.filter(p => p.clusterId !== clusterId);
  store.warehouse = store.warehouse.filter(w => w.clusterId !== clusterId);
  store.history = store.history.filter(h => h.clusterId !== clusterId);
  if (store.snapshots) {
    store.snapshots = store.snapshots.filter(s => !planIds.has(s.planId));
  }

  removeUploadsDir(clusterId);
  return { deleted: clusterId };
}

/**
 * Remove all warehouse + transform data for a cluster.
 */
export function clearClusterData(store, clusterId) {
  const cluster = store.clusters.find(c => c.id === clusterId);
  if (!cluster) {
    throw Object.assign(new Error('Cluster not found'), { status: 404 });
  }
  if (!clusterCanClearData(cluster)) {
    throw Object.assign(new Error('Cluster cannot be cleared'), { status: 403 });
  }

  const toRemove = (store.warehouse || []).filter(w => w.clusterId === clusterId);

  const removedIds = new Set(toRemove.map(w => w.id));
  store.warehouse = (store.warehouse || []).filter(w => !removedIds.has(w.id));

  const dataRoot = path.join(UPLOADS_ROOT, '..');
  for (const item of toRemove) {
    if (item.storagePath) {
      const abs = path.join(dataRoot, item.storagePath);
      if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch { /* ignore */ }
      }
    }
  }

  const planIds = new Set(
    (store.plans || []).filter(p => p.clusterId === clusterId).map(p => p.id)
  );
  store.history = (store.history || []).filter(h => h.clusterId !== clusterId);
  if (store.snapshots) {
    store.snapshots = store.snapshots.filter(s => !planIds.has(s.planId));
  }

  let transform = null;
  try {
    transform = clearTransformData(clusterId, ['golden', 'chunks', 'index']);
  } catch {
    transform = null;
  }

  return {
    clusterId,
    warehouseRemoved: toRemove.length,
    transformCleared: !!transform,
  };
}
