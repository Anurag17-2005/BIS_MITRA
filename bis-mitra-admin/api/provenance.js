import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_ROOT = path.join(__dirname, '..', 'data');
const BRONZE_ROOT = path.join(DATA_ROOT, 'bronze');
const UPLOAD_ROOT = path.join(DATA_ROOT, 'uploads');
const CLONE_FILES = process.env.CLONE_FILES_PATH
  || path.join(REPO_ROOT, 'bis-clone', 'public', 'files');
const KNOWLEDGE_PDFS = process.env.KNOWLEDGE_PDFS_PATH
  || path.join(REPO_ROOT, 'bis-clone', 'data', 'knowledge', 'pdfs');
const CLONE_FETCHED = process.env.FETCH_DATA_PATH
  || path.join(REPO_ROOT, 'bis-clone', 'data', 'fetched');

export function resolveWarehouseFilePath(item) {
  if (!item) return null;
  if (item.type === 'JSON' && item.content != null && !item.storagePath && !item.filePath) {
    return null;
  }

  if (item.storagePath) {
    const rel = String(item.storagePath)
      .replace(/^uploads[/\\]/, '')
      .replace(/\\/g, '/');
    return path.join(DATA_ROOT, 'uploads', rel);
  }

  if (item.filePath) {
    const raw = String(item.filePath).replace(/\\/g, '/');
    const fetchedIdx = raw.indexOf('/fetched/');
    if (item.fileSource === 'fetched' || fetchedIdx >= 0) {
      const rel = fetchedIdx >= 0
        ? raw.slice(fetchedIdx + '/fetched/'.length)
        : raw.replace(/^[/]+/, '');
      return path.join(CLONE_FETCHED, rel);
    }
    const normalized = raw.replace(/^[/]+/, '');
    if (normalized.startsWith('knowledge/pdfs/')) {
      return path.join(KNOWLEDGE_PDFS, normalized.slice('knowledge/pdfs/'.length));
    }
    const knowledgeOnly = normalized.replace(/^knowledge[/\\]pdfs[/\\]/, '');
    if (normalized !== knowledgeOnly) {
      return path.join(KNOWLEDGE_PDFS, knowledgeOnly);
    }
    const underKnowledge = path.join(KNOWLEDGE_PDFS, normalized);
    if (fs.existsSync(underKnowledge)) return underKnowledge;
    return path.join(CLONE_FILES, normalized);
  }

  if (item.clusterId && item.domain && item.name) {
    return path.join(DATA_ROOT, 'uploads', item.clusterId, item.domain, item.name);
  }

  return null;
}

export function bronzeDir(clusterId, fetchId) {
  return path.join(BRONZE_ROOT, clusterId, fetchId);
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function mimeForType(type, fileName = '') {
  const lower = (fileName || '').toLowerCase();
  if (type === 'JSON' || lower.endsWith('.json')) return 'application/json';
  if (type === 'Image' || lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
}

export function licenseClassForItem(item) {
  if (item.license_class) return item.license_class;
  if (item.source === 'upload') return 'user_provided';
  if (item.protected || item.source === 'default') return 'public';
  return 'public';
}

export function sourceIdForItem(item, plan) {
  if (item.catalog?.source_id) return item.catalog.source_id;
  if (item.source === 'upload') return 'manual_upload';
  if (item.source === 'default') return 'mitra_knowledge_seed';
  if (plan?.connector) return plan.connector;
  return item.planId || 'unknown';
}

export function resolveItemBytes(item) {
  if (item.storagePath) {
    const p = path.join(DATA_ROOT, item.storagePath);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  if (item.content != null) {
    return Buffer.from(JSON.stringify(item.content), 'utf8');
  }
  const filePath = resolveWarehouseFilePath(item);
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

export function buildCatalog(item, plan, extra = {}) {
  const buffer = extra.buffer || resolveItemBytes(item);
  const bytes = buffer?.length ?? extra.bytes ?? null;
  const contentSha = extra.content_sha256
    || (buffer ? sha256(buffer) : item.catalog?.content_sha256 || null);

  return {
    artifact_id: item.id,
    source_id: sourceIdForItem(item, plan),
    canonical_url: extra.canonical_url || item.catalog?.canonical_url || item.meta?.sourceUrl || null,
    document_key: extra.document_key
      || item.meta?.is_number
      || item.meta?.title
      || item.name,
    content_sha256: contentSha,
    fetched_at: extra.fetched_at || item.updatedAt || new Date().toISOString(),
    mime_type: extra.mime_type || mimeForType(item.type, item.name),
    bytes,
    language: item.meta?.lang || item.catalog?.language || 'en',
    storage_uri: item.storagePath || item.filePath || null,
    parent_artifact_id: extra.parent_artifact_id || item.catalog?.parent_artifact_id || null,
    license_class: extra.license_class || licenseClassForItem(item),
    status: extra.status || 'raw',
    fetch_id: extra.fetch_id || item.catalog?.fetch_id || null,
    etag: extra.etag || item.catalog?.etag || null,
    last_modified: extra.last_modified || item.catalog?.last_modified || null,
    version: extra.version || item.catalog?.version || 1,
    superseded_by: extra.superseded_by || item.catalog?.superseded_by || null,
  };
}

export function stampCatalog(item, plan, extra = {}) {
  item.catalog = buildCatalog(item, plan, extra);
  return item;
}

function safeName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Append-only fetch: write manifest + artifact copies under data/bronze/.
 */
export function recordFetch(store, {
  clusterId,
  planId = null,
  sourceId,
  startedAt,
  finishedAt,
  seedUrls = [],
  artifacts = [],
  errors = [],
}) {
  const fetchId = `fetch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const dir = bronzeDir(clusterId, fetchId);
  const artifactsDir = path.join(dir, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const manifestArtifacts = [];
  for (const a of artifacts) {
    const fileName = safeName(a.fileName || a.name || 'artifact');
    let uri = a.uri;
    if (a.buffer) {
      const dest = path.join(artifactsDir, fileName);
      fs.writeFileSync(dest, a.buffer);
      uri = path.relative(DATA_ROOT, dest).replace(/\\/g, '/');
    } else if (a.storagePath) {
      const src = path.join(DATA_ROOT, a.storagePath);
      if (fs.existsSync(src)) {
        const dest = path.join(artifactsDir, fileName);
        fs.copyFileSync(src, dest);
        uri = path.relative(DATA_ROOT, dest).replace(/\\/g, '/');
      }
    }
    manifestArtifacts.push({
      artifact_id: a.artifact_id,
      url: a.url || null,
      sha256: a.sha256 || null,
      uri,
      mime_type: a.mime_type || null,
      bytes: a.bytes || null,
      links_extracted: a.links_extracted || [],
      parent_artifact_id: a.parent_artifact_id || null,
    });
  }

  const manifest = {
    fetch_id: fetchId,
    cluster_id: clusterId,
    source_id: sourceId,
    plan_id: planId,
    started_at: startedAt,
    finished_at: finishedAt,
    seed_urls: seedUrls,
    artifacts: manifestArtifacts,
    errors,
  };

  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  if (!store.fetches) store.fetches = [];
  store.fetches.unshift({
    id: fetchId,
    clusterId,
    planId,
    sourceId,
    startedAt,
    finishedAt,
    manifestPath: path.relative(DATA_ROOT, manifestPath).replace(/\\/g, '/'),
    artifactCount: manifestArtifacts.length,
    errorCount: errors.length,
  });
  store.fetches = store.fetches.slice(0, 500);

  return { fetchId, manifest, manifestPath };
}

export function recordIngestionFailure(store, { planId, clusterId, url, error, retries = 0 }) {
  if (!store.ingestionFailures) store.ingestionFailures = [];
  store.ingestionFailures.unshift({
    id: `fail-${Date.now()}`,
    planId,
    clusterId,
    url: url || null,
    error: String(error).slice(0, 500),
    retries,
    at: new Date().toISOString(),
    status: 'open',
  });
  store.ingestionFailures = store.ingestionFailures.slice(0, 200);
}

export function detectContentChange(store, clusterId, canonicalUrl, newSha) {
  if (!canonicalUrl || !newSha) return { changed: true, previous: null };
  const prev = (store.warehouse || []).find(w =>
    w.clusterId === clusterId
    && w.catalog?.canonical_url === canonicalUrl
    && w.catalog?.content_sha256
  );
  if (!prev) return { changed: true, previous: null };
  if (prev.catalog.content_sha256 === newSha) {
    return { changed: false, previous: prev };
  }
  return { changed: true, previous: prev, previousSha: prev.catalog.content_sha256 };
}

export function backfillWarehouseCatalog(store) {
  let updated = 0;
  for (const item of store.warehouse || []) {
    if (item.catalog?.content_sha256) continue;
    const buffer = resolveItemBytes(item);
    const plan = (store.plans || []).find(p => p.id === item.planId);
    stampCatalog(item, plan, {
      buffer,
      fetch_id: item.catalog?.fetch_id || `legacy-${item.id}`,
      fetched_at: item.updatedAt,
    });
    updated++;
  }
  return updated;
}

export function readFetchManifest(manifestRelPath) {
  const p = path.join(DATA_ROOT, manifestRelPath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
