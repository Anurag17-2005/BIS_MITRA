#!/usr/bin/env node
import { runChunksPipeline } from '../api/transformation/pipeline/run-chunks.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const idx = args.indexOf('--cluster');
const clusterId = idx >= 0 ? args[idx + 1] : 'mitra-knowledge';

const manifests = runChunksPipeline({ clusterId: all ? null : clusterId, all });
for (const m of manifests) {
  console.log(`[chunks] ${m.clusterId}: ${m.chunkCount} chunks from ${m.goldenRecordCount} golden`);
}
