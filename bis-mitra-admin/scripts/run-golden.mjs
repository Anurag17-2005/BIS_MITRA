#!/usr/bin/env node
import { runGoldenPipeline } from '../api/transformation/pipeline/run-golden.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
let clusterId = null;

const clusterIdx = args.indexOf('--cluster');
if (clusterIdx >= 0 && args[clusterIdx + 1]) {
  clusterId = args[clusterIdx + 1];
}

if (!all && !clusterId) {
  clusterId = 'mitra-knowledge';
}

try {
  const manifests = await runGoldenPipeline({ clusterId, all });
  for (const m of manifests) {
    console.log(
      `[golden] ${m.clusterId}: ${m.goldenRecordCount}/${m.warehouseItemCount} records`,
      JSON.stringify(m.byStatus)
    );
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
