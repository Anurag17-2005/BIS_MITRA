#!/usr/bin/env node
/**
 * Post-deploy regression gate for production URLs.
 *
 *   ADMIN_API=https://… CLONE_API=https://… node scripts/prod-regate.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ADMIN = process.env.ADMIN_API || process.env.REND_ADMIN_API || '';
const CLONE = process.env.CLONE_API || process.env.REND_CLONE_API || '';

function run(label, cmd, args, extraEnv = {}) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv, ADMIN_API: ADMIN, CLONE_API: CLONE },
  });
  return r.status === 0;
}

async function main() {
  if (!ADMIN || !CLONE) {
    console.error('Set ADMIN_API and CLONE_API to Railway URLs.');
    process.exit(1);
  }
  let ok = true;
  ok = run('preflight', 'npm', ['run', 'test:preflight']) && ok;
  ok = run('smoke + chat', 'node', ['scripts/smoke-deploy.mjs'], { SMOKE_CHAT: '1' }) && ok;
  ok = run('proof:01 helmet', 'npm', ['run', 'test:proof:01'], {
    TEST_CLUSTER: 'mitra-knowledge',
  }) && ok;
  ok = run('proof:04–06 API', 'node', ['api/tests/agent/proof-actions-4-10.test.mjs', '--only=4'], {
    TEST_CLUSTER: 'mitra-knowledge',
  }) && ok;
  ok = run('proof:05 lab', 'node', ['api/tests/agent/proof-actions-4-10.test.mjs', '--only=5'], {
    TEST_CLUSTER: 'mitra-knowledge',
  }) && ok;
  ok = run('proof:06 CML', 'node', ['api/tests/agent/proof-actions-4-10.test.mjs', '--only=6'], {
    TEST_CLUSTER: 'mitra-knowledge',
  }) && ok;
  const userRoot = path.join(ROOT, '..', 'bis-mitra-user');
  console.log(`\n=== playwright prod (quick) ===`);
  const pw = spawnSync(
    'npm',
    ['run', 'test:e2e:prod', '--', 'proof-actions-quick.spec.js', 'knowledge-smoke.spec.js', 'portal-chrome.spec.js'],
    {
      cwd: userRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ADMIN_API: ADMIN, CLONE_API: CLONE, PLAYWRIGHT_PROD: '1' },
    },
  );
  ok = pw.status === 0 && ok;
  process.exit(ok ? 0 : 1);
}

main();
