import fs from 'fs';
import path from 'path';
import { PATHS } from './config/paths.js';

/**
 * Resolve a warehouse item to an on-disk file path (null if inline JSON only).
 */
export function resolveWarehouseFilePath(item) {
  if (!item) return null;
  if (item.type === 'JSON' && item.content != null && !item.storagePath && !item.filePath) {
    return null;
  }

  if (item.storagePath) {
    const rel = String(item.storagePath)
      .replace(/^uploads[/\\]/, '')
      .replace(/\\/g, '/');
    return path.join(PATHS.adminUploads, rel);
  }

  if (item.filePath) {
    const raw = String(item.filePath).replace(/\\/g, '/');
    const fetchedIdx = raw.indexOf('/fetched/');
    if (item.fileSource === 'fetched' || fetchedIdx >= 0) {
      const rel = fetchedIdx >= 0
        ? raw.slice(fetchedIdx + '/fetched/'.length)
        : raw.replace(/^[/]+/, '');
      return path.join(PATHS.cloneFetched, rel);
    }
    const normalized = raw.replace(/^[/]+/, '');
    if (normalized.startsWith('knowledge/pdfs/')) {
      return path.join(PATHS.knowledgePdfs, normalized.slice('knowledge/pdfs/'.length));
    }
    const knowledgeOnly = normalized.replace(/^knowledge[/\\]pdfs[/\\]/, '');
    if (normalized !== knowledgeOnly) {
      return path.join(PATHS.knowledgePdfs, knowledgeOnly);
    }
    const underKnowledge = path.join(PATHS.knowledgePdfs, normalized);
    if (fs.existsSync(underKnowledge)) return underKnowledge;
    return path.join(PATHS.cloneFiles, normalized);
  }

  if (item.clusterId && item.domain && item.name) {
    return path.join(PATHS.adminUploads, item.clusterId, item.domain, item.name);
  }

  return null;
}

export function loadAdminStore() {
  if (!fs.existsSync(PATHS.adminStore)) {
    throw new Error(`Admin store not found: ${PATHS.adminStore}`);
  }
  return JSON.parse(fs.readFileSync(PATHS.adminStore, 'utf8'));
}

/**
 * List warehouse items for one or all clusters.
 */
export function listWarehouseItems(store, { clusterId } = {}) {
  const items = store.warehouse || [];
  if (clusterId) return items.filter(w => w.clusterId === clusterId);
  return items;
}

export function listClusterIds(store) {
  const fromClusters = (store.clusters || []).map(c => c.id);
  const fromWarehouse = [...new Set((store.warehouse || []).map(w => w.clusterId))];
  return [...new Set([...fromClusters, ...fromWarehouse])].filter(Boolean);
}
