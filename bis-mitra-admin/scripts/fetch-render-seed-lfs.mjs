#!/usr/bin/env node
/**
 * Materialize Git LFS objects for data/render-seed when the build context has no .git
 * (e.g. Railway Railpack snapshot). No-op when seed files are already real JSON/binary.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { PATHS, seedIndexLiveSearch, copyDirRecursive } from './render-seed-paths.mjs';

const LFS_PREFIX = 'version https://git-lfs.github.com';
const DEFAULT_REPO = 'https://github.com/Anurag17-2005/BIS_MITRA.git';
const SPARSE_PATH = 'bis-mitra-admin/data/render-seed';

function isLfsPointer(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const head = fs.readFileSync(filePath, 'utf8').slice(0, 80);
  return head.startsWith(LFS_PREFIX);
}

function gitTopLevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env, shell: true });
}

function resolveRepoUrl() {
  if (process.env.GITHUB_REPOSITORY) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
      return `https://x-access-token:${token}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
    }
    return `https://github.com/${process.env.GITHUB_REPOSITORY}.git`;
  }
  return process.env.BIS_MITRA_GIT_URL || DEFAULT_REPO;
}

function resolveBranch() {
  return process.env.RAILWAY_GIT_BRANCH || process.env.GITHUB_REF_NAME || 'main';
}

function resolveCommitSha() {
  return process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
}

function pullLfsInWorkTree(repoRoot) {
  console.log(`[fetch-render-seed-lfs] git work tree at ${repoRoot} — git lfs pull`);
  run('git lfs install', repoRoot);
  run('git lfs pull', repoRoot);
}

function fetchViaShallowClone() {
  const repoUrl = resolveRepoUrl();
  const branch = resolveBranch();
  const sha = resolveCommitSha();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bis-mitra-render-seed-'));
  const repoDir = path.join(work, 'repo');

  console.log(`[fetch-render-seed-lfs] shallow clone ${repoUrl} (branch ${branch}${sha ? `, sha ${sha.slice(0, 7)}` : ''})`);

  run(
    `git clone --filter=blob:none --sparse --depth 1 --single-branch --branch "${branch}" "${repoUrl}" "${repoDir}"`,
    work,
  );
  run(`git sparse-checkout set "${SPARSE_PATH}"`, repoDir);
  run('git lfs install', repoDir);
  run('git lfs pull', repoDir);

  if (sha) {
    try {
      run(`git fetch --depth 1 origin "${sha}"`, repoDir);
      run(`git checkout "${sha}"`, repoDir);
      run('git lfs pull', repoDir);
    } catch (err) {
      console.warn(`[fetch-render-seed-lfs] checkout ${sha} failed — using branch tip: ${err.message}`);
    }
  }

  const fetchedSeed = path.join(repoDir, SPARSE_PATH);
  if (!fs.existsSync(fetchedSeed)) {
    console.error(`[fetch-render-seed-lfs] missing ${fetchedSeed} after clone`);
    process.exit(1);
  }

  if (fs.existsSync(PATHS.seedRoot)) {
    fs.rmSync(PATHS.seedRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(PATHS.seedRoot), { recursive: true });
  copyDirRecursive(fetchedSeed, PATHS.seedRoot);
  console.log(`[fetch-render-seed-lfs] copied render-seed → ${PATHS.seedRoot}`);

  fs.rmSync(work, { recursive: true, force: true });
}

function main() {
  const liveIndex = seedIndexLiveSearch();
  if (!fs.existsSync(liveIndex)) {
    console.log('[fetch-render-seed-lfs] No seed search-index — skip');
    process.exit(0);
  }
  if (!isLfsPointer(liveIndex)) {
    console.log('[fetch-render-seed-lfs] Seed index is not an LFS pointer — skip');
    process.exit(0);
  }

  console.log('[fetch-render-seed-lfs] LFS pointer detected — fetching real render-seed assets');

  const repoRoot = gitTopLevel(PATHS.adminRoot) || gitTopLevel(path.join(PATHS.adminRoot, '..'));
  if (repoRoot) {
    pullLfsInWorkTree(repoRoot);
  } else {
    fetchViaShallowClone();
  }

  if (isLfsPointer(liveIndex)) {
    console.error('[fetch-render-seed-lfs] search-index.json is still an LFS pointer after fetch');
    process.exit(1);
  }

  console.log('[fetch-render-seed-lfs] OK');
}

main();
