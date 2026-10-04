import { ADMIN, json, jsonAllowFail, TEST_CLUSTER } from './http.mjs';
import { getAdminHeaders } from './admin-auth.mjs';

export { TEST_CLUSTER };

export async function portalConfig() {
  return json(`${ADMIN}/api/portal/config`);
}

export async function listClusters() {
  const headers = await getAdminHeaders();
  return json(`${ADMIN}/api/clusters`, { headers });
}

export async function publishCluster(clusterId, published = true) {
  const headers = await getAdminHeaders();
  return json(`${ADMIN}/api/clusters/${clusterId}/publish`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ published }),
  });
}

export async function patchCluster(clusterId, body) {
  const headers = await getAdminHeaders();
  return json(`${ADMIN}/api/clusters/${clusterId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

export async function createCluster(name, description = '') {
  const headers = await getAdminHeaders();
  return json(`${ADMIN}/api/clusters`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteCluster(clusterId) {
  const headers = await getAdminHeaders();
  return jsonAllowFail(`${ADMIN}/api/clusters/${clusterId}`, {
    method: 'DELETE',
    headers,
  });
}

export async function clearClusterData(clusterId) {
  const headers = await getAdminHeaders();
  return jsonAllowFail(`${ADMIN}/api/clusters/${clusterId}/clear-data`, {
    method: 'POST',
    headers,
  });
}

export async function unpublishAll() {
  const clusters = await listClusters();
  const published = clusters.filter((c) => c.published);
  for (const c of published) {
    await publishCluster(c.id, false);
  }
}

export async function agentChat(message, clusterId, extra = {}) {
  return json(`${ADMIN}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      clusterId,
      language: 'en',
      ...extra,
    }),
  });
}
