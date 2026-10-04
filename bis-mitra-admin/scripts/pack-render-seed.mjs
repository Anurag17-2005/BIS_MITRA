#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { updateClusterFileCounts } from '../api/store.js';
import {
  PATHS,
  SEED_CLUSTER_ID,
  liveIndexLiveSearch,
  seedIndexLiveSearch,
  seedIndexesDir,
  seedUploadsDir,
  rmDirContents,
  copyDirRecursive,
} from './render-seed-paths.mjs';

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function ensureSeedCluster(store) {
  store.clusters = store.clusters || [];
  let cluster = store.clusters.find((c) => c.id === SEED_CLUSTER_ID);
  const whCount = (store.warehouse || []).filter((w) => w.clusterId === SEED_CLUSTER_ID).length;
  if (!cluster) {
    if (whCount === 0) {
      throw new Error(`No warehouse rows for "${SEED_CLUSTER_ID}". Run npm run seed:c2 first.`);
    }
    cluster = {
      id: SEED_CLUSTER_ID,
      name: 'MITRA Knowledge',
      description: 'Full BIS knowledge pack corpus',
      published: false,
      secured: false,
      deletable: true,
      renamable: true,
      fileCount: whCount,
    };
    store.clusters.push(cluster);
  }
  return cluster;
}

function normalizeStoreForRender(store) {
  const cluster = ensureSeedCluster(store);
  cluster.published = false;
  cluster.secured = false;
  cluster.deletable = cluster.deletable !== false;
  cluster.renamable = cluster.renamable !== false;
  cluster.name = cluster.name || 'MITRA Knowledge';
  cluster.description = cluster.description || 'Pre-built demo corpus — indexed for the agent';
  store.clusters = [cluster];
  store.warehouse = (store.warehouse || []).filter((w) => w.clusterId === SEED_CLUSTER_ID);
  store.plans = (store.plans || []).filter((p) => p.clusterId === SEED_CLUSTER_ID);
  store.history = (store.history || []).filter((h) => h.clusterId === SEED_CLUSTER_ID);
  store.snapshots = (store.snapshots || []).filter((s) => {
    const plan = store.plans.find((p) => p.id === s.planId);
    return plan?.clusterId === SEED_CLUSTER_ID;
  });
  store.fetches = [];
  store.ingestionFailures = [];
  store.automationEvents = [];
  updateClusterFileCounts(store);
  return store;
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else n += 1;
    }
  };
  walk(dir);
  return n;
}

function main() {
  const liveIndex = liveIndexLiveSearch();
  if (!fs.existsSync(liveIndex)) {
    console.error(`Missing live search index: ${liveIndex}`);
    console.error('Run: npm run build:mitra-knowledge (or golden:c2 → chunks:c2 → index:c2 → promote)');
    process.exit(1);
  }

  if (!fs.existsSync(PATHS.liveStore)) {
    console.error(`Missing ${PATHS.liveStore}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(PATHS.liveStore, 'utf8'));
  const store = normalizeStoreForRender(raw);

  fs.mkdirSync(PATHS.seedRoot, { recursive: true });

  const idxSeed = seedIndexesDir();
  rmDirContents(path.join(PATHS.seedRoot, 'indexes'));
  fs.mkdirSync(path.dirname(idxSeed), { recursive: true });
  copyDirRecursive(path.join(PATHS.liveIndexes, SEED_CLUSTER_ID), idxSeed);

  const uploadsLive = path.join(PATHS.liveUploads, SEED_CLUSTER_ID);
  const uploadsSeed = seedUploadsDir();
  rmDirContents(path.join(PATHS.seedRoot, 'uploads'));
  if (fs.existsSync(uploadsLive)) {
    copyDirRecursive(uploadsLive, uploadsSeed);
  } else {
    console.warn(`[pack] no uploads at ${uploadsLive} — warehouse may rely on clone-files only`);
  }

  fs.writeFileSync(PATHS.seedStore, JSON.stringify(store, null, 2));

  let chunkCount = 0;
  const chunksFile = path.join(idxSeed, 'chunks', '_chunks.json');
  if (fs.existsSync(chunksFile)) {
    chunkCount = JSON.parse(fs.readFileSync(chunksFile, 'utf8')).length;
  }

  const manifest = {
    clusterId: SEED_CLUSTER_ID,
    packedAt: new Date().toISOString(),
    gitSha: gitSha(),
    warehouseItems: store.warehouse.length,
    chunkCount,
    liveIndex: seedIndexLiveSearch(),
    uploadFiles: countFiles(uploadsSeed),
    indexFiles: countFiles(idxSeed),
  };
  fs.writeFileSync(PATHS.seedManifest, JSON.stringify(manifest, null, 2));

  console.log('[pack:render-seed]', JSON.stringify(manifest, null, 2));
  console.log(`Seed written under ${PATHS.seedRoot}`);
}

main();
