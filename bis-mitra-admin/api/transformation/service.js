import fs from 'fs';
import path from 'path';
import { goldenDir, chunksDir, indexDir, goldenRecordPath, PATHS } from './config/paths.js';
import { runGoldenForCluster, runGoldenPipeline } from './pipeline/run-golden.js';
import { runChunksForCluster, runChunksPipeline } from './pipeline/run-chunks.js';
import {
  runIndexForCluster,
  runIndexPipeline,
  searchIndex,
  promoteIndexToLive,
} from './pipeline/run-index.js';
import { runFullPipeline } from './pipeline/run-full.js';
import { runIncrementalTransform, listChangedWarehouseItems } from './pipeline/run-incremental.js';

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function getTransformStatus(clusterId) {
  const goldenManifest = readJsonIfExists(path.join(goldenDir(clusterId), '_manifest.json'));
  const chunksManifest = readJsonIfExists(path.join(chunksDir(clusterId), '_manifest.json'));
  const draftManifest = readJsonIfExists(path.join(indexDir(clusterId, 'draft'), '_manifest.json'));
  const liveManifest = readJsonIfExists(path.join(indexDir(clusterId, 'live'), '_manifest.json'));

  return {
    clusterId,
    golden: goldenManifest
      ? { count: goldenManifest.goldenRecordCount, at: goldenManifest.generatedAt, byStatus: goldenManifest.byStatus }
      : null,
    chunks: chunksManifest
      ? { count: chunksManifest.chunkCount, at: chunksManifest.generatedAt, bySection: chunksManifest.bySection }
      : null,
    index: {
      draft: draftManifest,
      live: liveManifest,
    },
    ready: !!(liveManifest || draftManifest),
  };
}

export function listGoldenSummaries(clusterId, { limit = 50, offset = 0 } = {}) {
  const dir = goldenDir(clusterId);
  if (!fs.existsSync(dir)) return { items: [], total: 0 };
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== '_manifest.json')
    .sort();
  const slice = files.slice(offset, offset + limit);
  const items = slice.map(f => {
    const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return {
      id: g.id,
      warehouseItemId: g.warehouseItemId,
      title: g.title,
      section: g.section,
      quality: g.quality?.status,
      textLength: (g.text || '').length,
      isNumbers: g.isNumbers,
      duplicateOf: g.duplicateOf,
    };
  });
  return { items, total: files.length };
}

export function getGoldenRecord(clusterId, warehouseItemId) {
  const p = goldenRecordPath(clusterId, warehouseItemId);
  if (!fs.existsSync(p)) return null;
  const g = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    ...g,
    textPreview: (g.text || '').slice(0, 2000),
    textTruncated: (g.text || '').length > 2000,
  };
}

const SECTION_ORDER = [
  'news', 'fees', 'manuals', 'standards', 'process',
  'schemes', 'hallmarking', 'labs', 'consumer',
];

function sectionSortKey(sectionId) {
  const i = SECTION_ORDER.indexOf(sectionId);
  return i === -1 ? 999 : i;
}

export function listGoldenGrouped(clusterId) {
  const { items, total } = listGoldenSummaries(clusterId, { limit: 5000, offset: 0 });
  const buckets = new Map();
  for (const item of items) {
    const sec = item.section || 'other';
    if (!buckets.has(sec)) buckets.set(sec, []);
    buckets.get(sec).push(item);
  }
  const sections = [...buckets.entries()]
    .sort((a, b) => sectionSortKey(a[0]) - sectionSortKey(b[0]))
    .map(([id, secItems]) => ({
      id,
      title: id.replace(/-/g, ' '),
      count: secItems.length,
      items: secItems.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    }));
  return { total, sections };
}

export function listChunksGrouped(clusterId) {
  const file = path.join(chunksDir(clusterId), '_chunks.json');
  if (!fs.existsSync(file)) return { total: 0, sections: [] };
  const chunks = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bySection = new Map();
  for (const c of chunks) {
    const sec = c.section || 'other';
    if (!bySection.has(sec)) bySection.set(sec, new Map());
    const sources = bySection.get(sec);
    const key = c.warehouseItemId || c.goldenId || c.title || c.id;
    if (!sources.has(key)) {
      sources.set(key, {
        warehouseItemId: c.warehouseItemId,
        goldenId: c.goldenId,
        title: c.title,
        chunks: [],
      });
    }
    sources.get(key).chunks.push({
      id: c.id,
      chunkIndex: c.chunkIndex,
      textPreview: c.text.slice(0, 220),
    });
  }
  const sections = [...bySection.entries()]
    .sort((a, b) => sectionSortKey(a[0]) - sectionSortKey(b[0]))
    .map(([id, sources]) => {
      const files = [...sources.values()].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      const chunkCount = files.reduce((n, f) => n + f.chunks.length, 0);
      return { id, title: id.replace(/-/g, ' '), fileCount: files.length, chunkCount, files };
    });
  return { total: chunks.length, sections };
}

export function listChunkSummaries(clusterId, { limit = 30, offset = 0, section } = {}) {
  const file = path.join(chunksDir(clusterId), '_chunks.json');
  if (!fs.existsSync(file)) return { items: [], total: 0 };
  let chunks = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (section) chunks = chunks.filter(c => c.section === section);
  const total = chunks.length;
  const items = chunks.slice(offset, offset + limit).map(c => ({
    id: c.id,
    warehouseItemId: c.warehouseItemId,
    section: c.section,
    sectionTag: c.sectionTag,
    title: c.title,
    chunkIndex: c.chunkIndex,
    textPreview: c.text.slice(0, 240),
  }));
  return { items, total };
}

export async function runTransform(clusterId, stage = 'all', options = {}) {
  const store = loadStore();
  if (stage === 'golden') return { golden: await runGoldenForCluster(clusterId, store) };
  if (stage === 'chunks') return { chunks: runChunksForCluster(clusterId) };
  if (stage === 'index') return { index: runIndexForCluster(clusterId, 'draft') };
  if (stage === 'incremental') return runIncrementalTransform(clusterId, options);
  if (stage === 'full') return runFullPipeline({ clusterId, skipGolden: false });
  return runFullPipeline({ clusterId, skipGolden: true });
}

function loadStore() {
  return JSON.parse(fs.readFileSync(PATHS.adminStore, 'utf8'));
}

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

/**
 * Remove golden, chunks, and/or index data for a cluster (raw warehouse untouched).
 */
export function clearTransformData(clusterId, layers = ['golden', 'chunks', 'index']) {
  const cleared = [];
  if (layers.includes('golden')) {
    fs.mkdirSync(goldenDir(clusterId), { recursive: true });
    rmDirContents(goldenDir(clusterId));
    cleared.push('golden');
  }
  if (layers.includes('chunks')) {
    fs.mkdirSync(chunksDir(clusterId), { recursive: true });
    rmDirContents(chunksDir(clusterId));
    cleared.push('chunks');
  }
  if (layers.includes('index')) {
    for (const stage of ['draft', 'live']) {
      fs.mkdirSync(indexDir(clusterId, stage), { recursive: true });
      rmDirContents(indexDir(clusterId, stage));
    }
    cleared.push('index');
  }
  return { clusterId, cleared, status: getTransformStatus(clusterId) };
}

export function listAllTransformStatus() {
  const store = loadStore();
  return store.clusters.map(c => ({
    clusterId: c.id,
    name: c.name,
    published: c.published,
    fileCount: c.fileCount || 0,
    ...getTransformStatus(c.id),
  }));
}

export {
  runGoldenPipeline,
  runGoldenForCluster,
  runChunksPipeline,
  runChunksForCluster,
  runIndexPipeline,
  runIndexForCluster,
  runFullPipeline,
  runIncrementalTransform,
  listChangedWarehouseItems,
  searchIndex,
  promoteIndexToLive,
};
