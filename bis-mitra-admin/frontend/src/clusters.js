/** Legacy id for un-prefixed plan templates; live published cluster is demo-pipeline-2 */
export const C1_CLUSTER_ID = 'demo-pipeline';
export const DEMO_CLUSTER_ID = 'demo-pipeline-2';
export const C2_CLUSTER_ID = 'mitra-knowledge';

export function planIdForCluster(clusterId, baseId) {
  if (!baseId) return baseId;
  if (clusterId === C1_CLUSTER_ID) return baseId;
  const prefix = `${clusterId}_`;
  if (baseId.startsWith(prefix)) return baseId;
  return `${clusterId}_${baseId}`;
}

export function stripClusterPrefix(planId, clusterId) {
  if (!planId) return planId;
  const id = String(planId);
  if (clusterId && clusterId !== C1_CLUSTER_ID) {
    const prefix = `${clusterId}_`;
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  const sandboxMatch = id.match(/^sandbox_(.+)$/);
  if (sandboxMatch) return sandboxMatch[1];
  if (id.startsWith(`${C2_CLUSTER_ID}_`)) {
    return id.slice(C2_CLUSTER_ID.length + 1);
  }
  return id;
}

export function isSecuredCluster(cluster) {
  if (!cluster) return false;
  return cluster.secured === true || cluster.id === C2_CLUSTER_ID;
}

export function clusterIsReadOnly(cluster) {
  if (!cluster) return false;
  return cluster.secured === true || cluster.deletable === false;
}

export function clusterCanRename(cluster) {
  if (!cluster) return false;
  return cluster.renamable !== false && !clusterIsReadOnly(cluster);
}

export function clusterCanDelete(cluster) {
  if (!cluster) return false;
  return cluster.deletable !== false && !clusterIsReadOnly(cluster);
}

export function clusterCanUnpublish(cluster) {
  if (!cluster) return false;
  return !clusterIsReadOnly(cluster);
}

export function clusterCanClearData(cluster) {
  return clusterCanDelete(cluster);
}

export function clusterCanRunTransform(cluster) {
  if (!cluster) return false;
  return !clusterIsReadOnly(cluster);
}
