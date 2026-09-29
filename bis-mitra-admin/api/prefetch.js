import { getStore, saveStore, updateClusterFileCounts } from './store.js';
import { runPlanInternal } from './runner-core.js';
import { normalizeFetchMethod } from './methods.js';
import { runPostIngestTransform } from './automation.js';

export async function prefetchCluster(clusterId, { skipScript = false } = {}) {
  const store = getStore();
  const ingestPlans = store.plans.filter(
    p => p.clusterId === clusterId && p.kind === 'ingest'
  );
  const results = [];
  for (const plan of ingestPlans) {
    if (skipScript && normalizeFetchMethod(plan.method) === 'script') {
      results.push({ planId: plan.id, skipped: true, reason: 'skipScript' });
      continue;
    }
    try {
      results.push(await runPlanInternal(store, plan.id));
    } catch (err) {
      results.push({ planId: plan.id, error: err.message });
    }
  }
  if (store.history.length > 200) store.history = store.history.slice(0, 200);
  updateClusterFileCounts(store);
  let transform = null;
  try {
    transform = await runPostIngestTransform(store, clusterId, [], 'prefetch');
  } catch (err) {
    transform = { error: err.message };
  }
  saveStore(store);
  return { clusterId, ran: ingestPlans.length, results, transform };
}
