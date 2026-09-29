#!/usr/bin/env node
import { runFullPipeline } from '../api/transformation/pipeline/run-full.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const idx = args.indexOf('--cluster');
const clusterId = idx >= 0 ? args[idx + 1] : 'mitra-knowledge';

const out = await runFullPipeline({ clusterId: all ? null : clusterId, all });
console.log('[full]', JSON.stringify({
  golden: out.golden?.map?.(m => m.clusterId) || out.golden?.clusterId,
  chunks: out.chunks?.map?.(m => `${m.clusterId}:${m.chunkCount}`),
  index: out.index?.map?.(m => `${m.clusterId}:${m.chunkCount}`),
}, null, 2));
