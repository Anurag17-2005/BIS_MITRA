import assert from 'node:assert/strict';
import { mergeSeedStoreIntoLive, SEED_CLUSTER_ID } from '../../../scripts/render-seed-merge.mjs';

const live = {
  version: 16,
  clusters: [
    {
      id: 'user-test',
      name: 'User Prod Cluster',
      published: true,
      deletable: true,
      renamable: true,
      secured: false,
      fileCount: 2,
    },
    {
      id: SEED_CLUSTER_ID,
      name: 'Old MK',
      published: false,
      deletable: false,
      renamable: true,
      secured: false,
      fileCount: 0,
    },
  ],
  plans: [
    { id: 'user-test_plan_a', clusterId: 'user-test' },
    { id: `${SEED_CLUSTER_ID}_old`, clusterId: SEED_CLUSTER_ID },
  ],
  warehouse: [
    { id: 'w-user-1', clusterId: 'user-test' },
    { id: 'w-user-2', clusterId: 'user-test' },
    { id: 'w-seed-old', clusterId: SEED_CLUSTER_ID },
  ],
  history: [{ clusterId: 'user-test', id: 'h1' }],
  snapshots: [],
};

const seed = {
  clusters: [{
    id: SEED_CLUSTER_ID,
    name: 'MITRA Knowledge',
    description: 'Seed',
    published: true,
    fileCount: 1,
  }],
  plans: [{ id: `${SEED_CLUSTER_ID}_new`, clusterId: SEED_CLUSTER_ID }],
  warehouse: [{ id: 'w-seed-new', clusterId: SEED_CLUSTER_ID }],
  history: [{ clusterId: SEED_CLUSTER_ID, id: 'h-seed' }],
  snapshots: [],
};

const merged = mergeSeedStoreIntoLive(structuredClone(live), seed);

const user = merged.clusters.find((c) => c.id === 'user-test');
assert.equal(user.published, true);
assert.equal(user.deletable, true);
assert.equal(merged.warehouse.filter((w) => w.clusterId === 'user-test').length, 2);

const mk = merged.clusters.find((c) => c.id === SEED_CLUSTER_ID);
assert.equal(mk.deletable, false);
assert.equal(mk.published, false);

assert.equal(merged.plans.filter((p) => p.clusterId === SEED_CLUSTER_ID).length, 1);
assert.ok(merged.plans.some((p) => p.id === `${SEED_CLUSTER_ID}_new`));
assert.ok(!merged.plans.some((p) => p.id === `${SEED_CLUSTER_ID}_old`));
assert.ok(merged.plans.some((p) => p.id === 'user-test_plan_a'));
assert.equal(merged.warehouse.filter((w) => w.clusterId === SEED_CLUSTER_ID).length, 1);
assert.equal(merged.warehouse.find((w) => w.id === 'w-seed-new').id, 'w-seed-new');

console.log(JSON.stringify({ ok: true, clusterCount: merged.clusters.length }, null, 2));
