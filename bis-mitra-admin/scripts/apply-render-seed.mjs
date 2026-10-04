#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {
  PATHS,
  SEED_CLUSTER_ID,
  seedIndexesDir,
  seedUploadsDir,
  seedIndexLiveSearch,
  copyDirRecursive,
} from './render-seed-paths.mjs';

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

  fs.mkdirSync(path.dirname(PATHS.liveStore), { recursive: true });
  fs.copyFileSync(PATHS.seedStore, PATHS.liveStore);
  console.log(`[apply:render-seed] admin-store.json ← seed (${SEED_CLUSTER_ID})`);

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

  if (fs.existsSync(PATHS.seedManifest)) {
    const manifest = JSON.parse(fs.readFileSync(PATHS.seedManifest, 'utf8'));
    console.log('[apply:render-seed] MANIFEST', manifest);
  }
}

main();
