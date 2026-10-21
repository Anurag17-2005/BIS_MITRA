import { listChangedWarehouseItems } from './transformation/pipeline/run-incremental.js';
import { runPostIngestTransform } from './automation.js';
import { getActivePipelineJob } from './pipeline-status.js';
import { defaultAutomationConfig } from './automation.js';

let inFlight = false;

/**
 * Lightweight hosted transform loop (no full scheduler). Enable with ENABLE_HOSTED_PIPELINE=1 on Railway.
 */
export function startHostedPipelineWatcher(getStore, saveStore, intervalMs = 60000) {
  console.log(`[hosted-pipeline] watcher every ${intervalMs / 1000}s`);
  const tick = async () => {
    if (inFlight) return;
    const store = getStore();
    const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
    if (!cfg.autoTransform) return;

    for (const cluster of store.clusters || []) {
      if (getActivePipelineJob(cluster.id)) continue;
      let pending = [];
      try {
        pending = listChangedWarehouseItems(cluster.id, store);
      } catch {
        pending = [];
      }
      if (!pending.length) continue;

      inFlight = true;
      try {
        console.log(`[hosted-pipeline] transform ${cluster.id} (${pending.length} pending)`);
        await runPostIngestTransform(store, cluster.id, [], 'hosted_pipeline');
        saveStore(store);
      } catch (err) {
        console.error(`[hosted-pipeline] ${cluster.id}:`, err.message);
      } finally {
        inFlight = false;
      }
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
