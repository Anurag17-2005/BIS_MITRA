import assert from 'node:assert/strict';
import {
  TEST_CLUSTER,
  portalConfig,
  publishCluster,
  listClusters,
  unpublishAll,
  agentChat,
  createCluster,
  deleteCluster,
} from '../helpers/cluster-api.mjs';

const LEAVE = process.env.TEST_LEAVE_PUBLISHED === '1';
let restoreId = null;

const before = await portalConfig();
restoreId = before.publishedClusterId || null;

try {
  await unpublishAll();
  let cfg = await portalConfig();
  assert.equal(cfg.publishedClusterId, null);

  const pub = await publishCluster(TEST_CLUSTER, true);
  const publishedCount = (pub.clusters || []).filter((c) => c.published).length;
  assert.equal(publishedCount, 1);

  cfg = await portalConfig();
  assert.equal(cfg.publishedClusterId, TEST_CLUSTER);
  assert.ok(cfg.publishedClusterName);

  const clusters = await listClusters();
  const meta = clusters.find((c) => c.id === TEST_CLUSTER);
  assert.ok(meta?.published);

  const chatRes = await agentChat(
    'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?',
    cfg.publishedClusterId,
    {
      personaMode: 'industry',
      userPersona: 'industry',
      sessionId: `pub-cross-${Date.now()}`,
      userId: 'industry',
      userProfile: {
        name: 'Proof User',
        org: 'Test Co',
        products: 'Industrial safety helmet',
      },
    },
  );
  assert.ok(
    chatRes.panel?.compliance || (chatRes.answer && chatRes.answer.length > 20),
    'chat should return compliance panel or substantive answer',
  );

  await publishCluster(TEST_CLUSTER, false);
  cfg = await portalConfig();
  assert.equal(cfg.publishedClusterId, null);

  const suffix = `${Date.now()}`.slice(-6);
  const a = await createCluster(`Exclusive A ${suffix}`, 'test');
  const b = await createCluster(`Exclusive B ${suffix}`, 'test');
  await publishCluster(a.id, true);
  cfg = await portalConfig();
  assert.equal(cfg.publishedClusterId, a.id);
  await publishCluster(b.id, true);
  cfg = await portalConfig();
  assert.equal(cfg.publishedClusterId, b.id);
  const listed = await listClusters();
  assert.equal(listed.filter((c) => c.published).length, 1);

  await deleteCluster(b.id);
  await deleteCluster(a.id);

  console.log(JSON.stringify({ ok: true, testCluster: TEST_CLUSTER }, null, 2));
} finally {
  if (!LEAVE) {
    await unpublishAll();
    if (restoreId) {
      try {
        await publishCluster(restoreId, true);
      } catch {
        /* cluster may have been removed */
      }
    }
  }
}
