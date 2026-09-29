#!/usr/bin/env node
import { runIndexPipeline } from '../api/transformation/pipeline/run-index.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const idx = args.indexOf('--cluster');
const clusterId = idx >= 0 ? args[idx + 1] : 'mitra-knowledge';

const manifests = runIndexPipeline({ clusterId: all ? null : clusterId, all });
for (const m of manifests) {
  console.log(`[index] ${m.clusterId}: ${m.chunkCount} chunks, vocab ${m.vocabularySize}`);
}
