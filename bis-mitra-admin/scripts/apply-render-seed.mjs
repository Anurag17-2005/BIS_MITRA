#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { mergeSeedStoreIntoLive } from './render-seed-merge.mjs';
import {
  PATHS,
  SEED_CLUSTER_ID,
  seedIndexesDir,
  seedUploadsDir,
  seedIndexLiveSearch,
  copyDirRecursive,
} from './render-seed-paths.mjs';

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function loadJson(pathname, fallback) {
  if (!fs.existsSync(pathname)) return fallback;
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function main() {
  if (!fs.existsSync(PATHS.seedStore)) {
    console.log('[apply:render-seed] No seed store — skip (local dev or seed not committed yet).');
    process.exit(0);
  }

  const liveIndex = seedIndexLiveSearch();
  if (!fs.existsSync(liveIndex)) {
    console.warn(`[apply:render-seed] Seed missing live index at ${liveIndex} — skip apply.`);
    process.exit(0);
  }

  const seed = loadJson(PATHS.seedStore, null);
  const live = loadJson(PATHS.liveStore, {
    version: 16,
    clusters: [],
    plans: [],
    warehouse: [],
    history: [],
    snapshots: [],
    fetches: [],
    ingestionFailures: [],
    automationEvents: [],
    automation: {
      enabled: true,
      pollIntervalMs: 30000,
      autoTransform: true,
      promoteOnPublished: true,
      targetClusterIds: [],
      autofetchClusterIds: [],
      cloneFingerprints: {},
      lastSyncedFingerprints: {},
    },
  });

  const merged = mergeSeedStoreIntoLive(live, seed);
  merged.version = merged.version || 16;

  fs.mkdirSync(path.dirname(PATHS.liveStore), { recursive: true });
  const tmp = `${PATHS.liveStore}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
  fs.renameSync(tmp, PATHS.liveStore);
  console.log(
    `[apply:render-seed] admin-store.json merged (${SEED_CLUSTER_ID} corpus; ${merged.clusters.length} cluster(s) total)`,
  );

  const idxLive = path.join(PATHS.liveIndexes, SEED_CLUSTER_ID);
  fs.mkdirSync(PATHS.liveIndexes, { recursive: true });
  if (fs.existsSync(idxLive)) fs.rmSync(idxLive, { recursive: true, force: true });
  copyDirRecursive(seedIndexesDir(), idxLive);
  console.log(`[apply:render-seed] indexes/${SEED_CLUSTER_ID} ← seed`);

  const uploadsSeed = seedUploadsDir();
  const uploadsLive = path.join(PATHS.liveUploads, SEED_CLUSTER_ID);
  if (fs.existsSync(uploadsSeed)) {
    fs.mkdirSync(PATHS.liveUploads, { recursive: true });
    if (fs.existsSync(uploadsLive)) fs.rmSync(uploadsLive, { recursive: true, force: true });
    copyDirRecursive(uploadsSeed, uploadsLive);
    console.log(`[apply:render-seed] uploads/${SEED_CLUSTER_ID} ← seed`);
  }

  const manifest = fs.existsSync(PATHS.seedManifest)
    ? JSON.parse(fs.readFileSync(PATHS.seedManifest, 'utf8'))
    : {};
  manifest.appliedAt = new Date().toISOString();
  manifest.appliedGitSha = gitSha();
  console.log('[apply:render-seed] MANIFEST', manifest);
}

main();
