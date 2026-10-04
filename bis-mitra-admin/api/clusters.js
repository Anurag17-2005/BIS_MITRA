/** C1 demo cluster — legacy unprefixed plan ids */
export const C1_CLUSTER_ID = 'demo-pipeline';

/** C2 knowledge corpus */
export const C2_CLUSTER_ID = 'mitra-knowledge';

export const RESERVED_CLUSTER_IDS = new Set([
  C1_CLUSTER_ID,
  C2_CLUSTER_ID,
  'global-bis',
  'sandbox',
]);

/**
 * Plan id for a cluster: demo-pipeline keeps unprefixed base ids; all others use `{clusterId}_{baseId}`.
 */
export function planIdForCluster(clusterId, baseId) {
  if (!baseId) return baseId;
  if (clusterId === C1_CLUSTER_ID) return baseId;
  const prefix = `${clusterId}_`;
  if (baseId.startsWith(prefix)) return baseId;
  return `${clusterId}_${baseId}`;
}

/**
 * Strip cluster prefix or legacy sandbox_ prefix from a plan id.
 */
export function stripClusterPrefix(planId, clusterId) {
  if (!planId) return planId;
  const id = String(planId);
  if (clusterId && clusterId !== C1_CLUSTER_ID) {
    const prefix = `${clusterId}_`;
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  const sandboxMatch = id.match(/^sandbox_(.+)$/);
  if (sandboxMatch) return sandboxMatch[1];
  for (const cid of [C2_CLUSTER_ID]) {
    const prefix = `${cid}_`;
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  return id;
}

export function clusterCanRename(cluster) {
  if (!cluster) return false;
  return cluster.renamable !== false;
}

export function clusterCanDelete(cluster) {
  if (!cluster) return false;
  return cluster.deletable !== false;
}

export function clusterCanUnpublish(_cluster) {
  return true;
}

export function clusterCanClearData(cluster) {
  return clusterCanDelete(cluster);
}

export function clusterCanRunTransform(cluster) {
  return Boolean(cluster);
}
