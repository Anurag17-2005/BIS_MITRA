import { publishCluster, TEST_CLUSTER, unpublishAll, listClusters } from '../../bis-mitra-admin/api/tests/helpers/cluster-api.mjs';

const PROD_KNOWLEDGE = 'mitra-knowledge';

export default async function globalSetup() {
  const isProd = process.env.PLAYWRIGHT_PROD === '1'
    || String(process.env.PLAYWRIGHT_BASE_URL || '').includes('vercel.app');
  process.env.ADMIN_API = process.env.ADMIN_API
    || (isProd ? 'https://bismitra-production.up.railway.app' : 'http://127.0.0.1:5050');
  process.env.CLONE_API = process.env.CLONE_API
    || (isProd ? 'https://bis-clone-production.up.railway.app' : 'http://127.0.0.1:4000');

  const target = isProd
    ? (process.env.TEST_CLUSTER || PROD_KNOWLEDGE)
    : (process.env.TEST_CLUSTER || TEST_CLUSTER);

  process.env.TEST_CLUSTER = target;

  try {
    const clusters = await listClusters();
    const ids = new Set((clusters || []).map((c) => c.id));
    if (!ids.has(target)) {
      console.warn(`[e2e setup] cluster "${target}" not on admin — skip publish`);
      return;
    }
    if (!isProd) {
      await unpublishAll();
    }
    await publishCluster(target, true);
    console.log(`[e2e setup] published ${target} on ${process.env.ADMIN_API}`);
  } catch (err) {
    console.warn('[e2e setup] publish skipped:', err.message);
  }
}
