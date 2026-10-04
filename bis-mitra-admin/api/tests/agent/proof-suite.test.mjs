#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
const node = process.execPath;

const steps = [
  { id: '1', cmd: [node, 'api/tests/agent/industry-proof-actions.test.mjs', '--only=1'] },
  { id: '2', cmd: [node, 'api/tests/agent/industry-proof-actions.test.mjs', '--only=2'] },
  { id: '3', cmd: [node, 'api/tests/agent/industry-proof-actions.test.mjs', '--only=3'], needsRef: true },
  ...[4, 5, 6, 7, 8, 9, 10].map((n) => ({
    id: String(n),
    cmd: [node, 'api/tests/agent/proof-actions-4-10.test.mjs', `--only=${n}`],
  })),
];

const summary = [];
let referenceId = process.env.PROOF_REFERENCE_ID || '';
const env = { ...process.env };

for (const step of steps) {
  if (step.needsRef && referenceId) {
    env.PROOF_REFERENCE_ID = referenceId;
  }
  const t0 = Date.now();
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ms = Date.now() - t0;
  const pass = result.status === 0;
  if (step.id === '2' && pass) {
    try {
      const lines = (result.stdout || '').trim().split('\n');
      const last = JSON.parse(lines[lines.length - 1]);
      if (last.referenceId) referenceId = last.referenceId;
      env.PROOF_REFERENCE_ID = referenceId;
      env.PROOF_SESSION_ID = last.sessionId;
    } catch { /* ignore */ }
  }
  summary.push({
    action: step.id,
    pass,
    ms,
    stderr: pass ? undefined : (result.stderr || result.stdout || '').slice(-400),
  });
  if (!pass) break;
}

console.log(JSON.stringify({ ok: summary.every((s) => s.pass), summary, referenceId }, null, 2));
process.exit(summary.every((s) => s.pass) ? 0 : 1);
