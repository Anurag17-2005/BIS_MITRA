import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFetchManifest } from './provenance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSFORM_ROOT = path.join(__dirname, '..', 'data', 'indexes');

export function getLineage(store, warehouseItemId) {
  const item = (store.warehouse || []).find(w => w.id === warehouseItemId);
  if (!item) return null;

  const plan = (store.plans || []).find(p => p.id === item.planId);
  const fetch = (store.fetches || []).find(f =>
    f.id === item.catalog?.fetch_id
    || (f.planId === item.planId && f.clusterId === item.clusterId)
  );

  let manifest = null;
  if (fetch?.manifestPath) {
    manifest = readFetchManifest(fetch.manifestPath);
  }

  const safe = String(warehouseItemId).replace(/[^a-zA-Z0-9._-]/g, '_');
  const goldenPath = path.join(TRANSFORM_ROOT, item.clusterId, 'golden', `${safe}.json`);
  let golden = null;
  if (fs.existsSync(goldenPath)) {
    golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  }

  let chunks = [];
  const chunksFile = path.join(TRANSFORM_ROOT, item.clusterId, 'chunks', '_chunks.json');
  if (fs.existsSync(chunksFile)) {
    const all = JSON.parse(fs.readFileSync(chunksFile, 'utf8'));
    chunks = all.filter(c => c.warehouseItemId === item.id);
  }

  const liveManifest = path.join(TRANSFORM_ROOT, item.clusterId, 'index', 'live', '_manifest.json');
  const indexed = fs.existsSync(liveManifest);

  const catalog = item.catalog || {};
  const steps = [
    {
      id: 'source',
      label: 'Source',
      value: catalog.canonical_url || plan?.name || item.source,
      meta: catalog.source_id,
    },
    {
      id: 'fetch',
      label: 'Fetch',
      value: catalog.fetch_id || fetch?.id || '—',
      meta: fetch?.finishedAt || catalog.fetched_at,
    },
    {
      id: 'artifact',
      label: 'Bronze artifact',
      value: catalog.artifact_id || item.id,
      meta: catalog.content_sha256 ? `${catalog.content_sha256.slice(0, 12)}…` : null,
    },
    {
      id: 'golden',
      label: 'Golden',
      value: golden ? golden.quality?.status || 'ok' : 'not built',
      meta: golden?.provenance?.processedAt,
    },
    {
      id: 'chunks',
      label: 'Chunks',
      value: chunks.length ? `${chunks.length} chunk(s)` : 'none',
      meta: chunks[0]?.id,
    },
    {
      id: 'index',
      label: 'Search index',
      value: indexed ? 'live' : 'not promoted',
      meta: indexed ? 'tfidf-v1' : null,
    },
  ];

  return {
    warehouseItemId: item.id,
    title: item.meta?.title || item.name,
    section: item.domain,
    catalog,
    fetch: fetch ? { ...fetch, manifest } : null,
    golden: golden ? {
      id: golden.id,
      quality: golden.quality?.status,
      textLength: (golden.text || '').length,
      isNumbers: golden.isNumbers,
    } : null,
    chunks: chunks.map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      textPreview: (c.text || '').slice(0, 120),
      citation: c.citation || null,
    })),
    indexed,
    steps,
  };
}

export function getTrustSummary(store, clusterId) {
  const items = (store.warehouse || []).filter(w => w.clusterId === clusterId);
  const withSha = items.filter(w => w.catalog?.content_sha256).length;
  const fetches = (store.fetches || []).filter(f => f.clusterId === clusterId);
  const failures = (store.ingestionFailures || []).filter(f => f.clusterId === clusterId && f.status === 'open');
  const quarantine = listQuarantine(clusterId);

  return {
    clusterId,
    artifacts: items.length,
    traced: withSha,
    fetchRuns: fetches.length,
    openFailures: failures.length,
    quarantineCount: quarantine.length,
    licenseMix: countBy(items, w => w.catalog?.license_class || 'unknown'),
  };
}

export function listQuarantine(clusterId) {
  const dir = path.join(TRANSFORM_ROOT, clusterId, 'quarantine');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json') && n !== '_manifest.json')) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      out.push({
        id: rec.warehouseItemId || f.replace(/\.json$/, ''),
        title: rec.title || rec.name || f,
        reason: rec.quarantine?.reason || rec.quality?.warnings?.join('; ') || 'failed quality',
        status: rec.quality?.status || 'failed',
        at: rec.quarantine?.at || rec.provenance?.processedAt || null,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

function countBy(rows, fn) {
  const out = {};
  for (const r of rows) {
    const k = fn(r);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
