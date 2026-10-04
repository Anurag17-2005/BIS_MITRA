import assert from 'node:assert/strict';
import { CLONE, CLUSTER, json } from './proof-helpers.mjs';
import { assertCompliance, assertConfirmReady, assertSourcesMin } from '../helpers/panel-assert.mjs';

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const run = (n) => !only || only === String(n);

const suffix = `${Date.now()}`.slice(-6);
const sessionId = process.env.PROOF_SESSION_ID || `proof-test-${suffix}`;
const userId = 'industry';

function chat(message, extra = {}) {
  return json(`${process.env.ADMIN_API || 'http://localhost:5050'}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      clusterId: CLUSTER,
      personaMode: 'industry',
      userPersona: 'industry',
      sessionId,
      userId,
      language: 'en',
      conversationId: `industry-proof-${suffix}`,
      userProfile: {
        name: 'Rahul Mehta',
        org: `NovaShield Proof Works ${suffix}`,
        products: `Industrial safety helmet — Model NSH-${suffix}`,
        udyam: `UDYAM-MH-12-${suffix}`,
        email: `proof-${suffix}@novashield.demo`,
      },
      ...extra,
    }),
  });
}

let referenceId = process.env.PROOF_REFERENCE_ID || null;
let complianceResult = null;

if (run(1)) {
  complianceResult = await chat(
    'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?',
  );
  assertCompliance(complianceResult.panel);
  assertSourcesMin(complianceResult.sources, 'STD-DEMO-001');
}

if (run(2)) {
  const before = await json(`${CLONE}/api/applications`);
  const start = await chat(
    'I want to apply for certification for my industrial safety helmet under IS DEMO 1001:2026. Help me complete and submit the application.',
  );
  assert.match(start.answer, /lab test report/i);
  await chat(`NTH-HELMET-${suffix}`);
  const review = await chat('I declare that the details and attached test evidence are accurate.');
  assertConfirmReady(review);
  const submitted = await chat('Confirm', {
    confirmSubmit: true,
    confirmFields: review.panel.confirmTable.fields,
  });
  referenceId = submitted.panel?.record_id;
  assert.match(referenceId, /^BIS-APP-DEMO-\d{6}$/);
  const persisted = await json(`${CLONE}/api/applications?reference_id=${referenceId}`);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].status, 'Submitted');
  assert.equal(persisted[0].owner_session_id, sessionId);
  assert.equal((await json(`${CLONE}/api/applications`)).length, before.length + 1);
}

if (run(3)) {
  if (!referenceId) {
    throw new Error('PROOF_REFERENCE_ID required for --only=3 (run --only=2 first or set env)');
  }
  for (const [status, note] of [
    ['Under Review', 'Documents verified'],
    ['Testing', 'Required product tests started'],
    ['Certified', 'All required tests passed'],
  ]) {
    await json(`${CLONE}/api/applications/${referenceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        changed_by: 'Proof BIS Certification Officer',
        note,
      }),
    });
  }
  const workflow = await json(`${CLONE}/api/ebis/status/${referenceId}`);
  assert.equal(workflow.current_status, 'Certified');
  const alerts = await json(
    `${process.env.ADMIN_API || 'http://localhost:5050'}/api/agent/alerts?sessionId=${encodeURIComponent(sessionId)}&userId=${userId}`,
  );
  const approval = alerts.alerts.find((alert) => alert.title.startsWith('Certification Approved'));
  assert.ok(approval, 'certification approval alert missing');
  const status = await chat(`What is the status of my certification application ${referenceId}?`);
  assert.equal(status.panel?.status, 'Certified');
  assert.ok(status.panel.status_history.length >= 4);
}

if (!only) {
  console.log(JSON.stringify({
    ok: true,
    cluster: CLUSTER,
    standard: complianceResult?.panel?.compliance?.standard_number,
    referenceId,
    sourceCount: complianceResult?.sources?.length,
  }, null, 2));
} else {
  console.log(JSON.stringify({ ok: true, only, referenceId, sessionId }, null, 2));
}
