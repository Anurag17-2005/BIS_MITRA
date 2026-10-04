import { publishCluster, TEST_CLUSTER, unpublishAll } from '../../bis-mitra-admin/api/tests/helpers/cluster-api.mjs';

export default async function globalSetup() {
  process.env.ADMIN_API = process.env.ADMIN_API || 'http://127.0.0.1:5050';
  process.env.TEST_CLUSTER = process.env.TEST_CLUSTER || TEST_CLUSTER;
  try {
    await unpublishAll();
    await publishCluster(process.env.TEST_CLUSTER, true);
  } catch (err) {
    console.warn('[e2e setup] publish skipped:', err.message);
  }
}
