import fs from 'fs';
import path from 'path';
import { goldenDir, PATHS } from '../config/paths.js';
import { buildChunksFromGolden } from '../chunk/splitter.js';
import { writeChunkManifest, writeChunksBundle } from '../writers/chunk-writer.js';

function loadGoldenRecords(clusterId) {
  const dir = goldenDir(clusterId);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_manifest.json');
  const records = [];
  for (const f of files) {
    try {
      records.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch {
      /* skip corrupt */
    }
  }
  return records;
}

export function runChunksForCluster(clusterId) {
  const goldens = loadGoldenRecords(clusterId);
  const allChunks = [];
  const bySection = {};
  let skippedDuplicates = 0;

  for (const g of goldens) {
    if (g.quality?.status === 'duplicate') {
      skippedDuplicates++;
      continue;
    }
    if (g.quality?.status === 'failed' || g.quarantine) {
      continue;
    }
    const chunks = buildChunksFromGolden(g);
    for (const c of chunks) {
      allChunks.push(c);
      bySection[c.section] = (bySection[c.section] || 0) + 1;
    }
  }

  writeChunksBundle(clusterId, allChunks);
  const manifest = {
    clusterId,
    generatedAt: new Date().toISOString(),
    pipeline: 'chunks-v1',
    goldenRecordCount: goldens.length,
    chunkCount: allChunks.length,
    skippedDuplicates,
    bySection,
  };
  writeChunkManifest(clusterId, manifest);
  return manifest;
}

export function runChunksPipeline({ clusterId, all = false } = {}) {
  let ids = clusterId ? [clusterId] : [];
  if (all && fs.existsSync(PATHS.dataRoot)) {
    ids = fs.readdirSync(PATHS.dataRoot).filter(d =>
      fs.existsSync(path.join(PATHS.dataRoot, d, 'golden', '_manifest.json'))
    );
  }
  if (!ids.length) throw new Error('No cluster with golden layer found');
  return ids.map(id => runChunksForCluster(id));
}
