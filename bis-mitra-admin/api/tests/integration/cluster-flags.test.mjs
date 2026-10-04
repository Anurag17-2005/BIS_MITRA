import assert from 'node:assert/strict';
import {
  createCluster,
  patchCluster,
  deleteCluster,
  clearClusterData,
} from '../helpers/cluster-api.mjs';

const suffix = `${Date.now()}`.slice(-6);
const cluster = await createCluster(`Flags test ${suffix}`, 'ephemeral');

const locked = await patchCluster(cluster.id, { deletable: false });
assert.equal(locked.deletable, false);

let del = await deleteCluster(cluster.id);
assert.equal(del.ok, false);
assert.equal(del.status, 403);

let clear = await clearClusterData(cluster.id);
assert.equal(clear.ok, false);
assert.equal(clear.status, 403);

await patchCluster(cluster.id, { deletable: true });
del = await deleteCluster(cluster.id);
assert.equal(del.ok, true);

console.log(JSON.stringify({ ok: true, clusterId: cluster.id }, null, 2));
