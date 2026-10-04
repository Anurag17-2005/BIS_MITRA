import { updateClusterFileCounts } from '../api/store.js';
import { C2_CLUSTER_ID } from '../api/clusters.js';

export const SEED_CLUSTER_ID = C2_CLUSTER_ID;

/**
 * Merge committed seed corpus for mitra-knowledge into live store.
 * Preserves other clusters and operator flags (published, deletable, etc.).
 */
export function mergeSeedStoreIntoLive(live, seed, clusterId = SEED_CLUSTER_ID) {
  const cid = clusterId;
  const seedPlans = (seed.plans || []).filter((p) => p.clusterId === cid);
  const seedPlanIds = new Set(seedPlans.map((p) => p.id));

  live.clusters = live.clusters || [];
  live.warehouse = live.warehouse || [];
  live.plans = live.plans || [];
  live.history = live.history || [];
  live.snapshots = live.snapshots || [];

  live.warehouse = live.warehouse.filter((w) => w.clusterId !== cid)
    .concat((seed.warehouse || []).filter((w) => w.clusterId === cid));
  live.plans = live.plans.filter((p) => p.clusterId !== cid).concat(seedPlans);
  live.history = live.history.filter((h) => h.clusterId !== cid)
    .concat((seed.history || []).filter((h) => h.clusterId === cid));
  live.snapshots = live.snapshots.filter((s) => !seedPlanIds.has(s.planId))
    .concat((seed.snapshots || []).filter((s) => seedPlanIds.has(s.planId)));

  const seedCluster = (seed.clusters || []).find((c) => c.id === cid);
  const liveCluster = live.clusters.find((c) => c.id === cid);

  if (!liveCluster && seedCluster) {
    live.clusters.push({
      ...seedCluster,
      published: false,
      secured: false,
      deletable: seedCluster.deletable !== false,
      renamable: seedCluster.renamable !== false,
    });
  } else if (liveCluster && seedCluster) {
    if (!liveCluster.name) liveCluster.name = seedCluster.name;
    if (!liveCluster.description) liveCluster.description = seedCluster.description;
    liveCluster.secured = false;
  } else if (!liveCluster && !seedCluster) {
    const whCount = (seed.warehouse || []).filter((w) => w.clusterId === cid).length;
    if (whCount > 0) {
      live.clusters.push({
        id: cid,
        name: 'MITRA Knowledge',
        description: 'Full BIS knowledge pack corpus',
        published: false,
        secured: false,
        deletable: true,
        renamable: true,
        fileCount: whCount,
      });
    }
  }

  updateClusterFileCounts(live);
  return live;
}
