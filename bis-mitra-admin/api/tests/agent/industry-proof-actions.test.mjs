import assert from 'node:assert/strict';

const ADMIN = process.env.ADMIN_API || 'http://localhost:5050';
const CLONE = process.env.CLONE_API || 'http://localhost:4000';
const CLUSTER = process.env.TEST_CLUSTER || 'proof-actions-sandbox';
const suffix = `${Date.now()}`.slice(-6);
const sessionId = `proof-test-${suffix}`;
const userId = 'industry';

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${url}: ${body.error || response.statusText}`);
  return body;
}

function chat(message, extra = {}) {
  return json(`${ADMIN}/api/agent/chat`, {
    method: 'POST',
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

const compliance = await chat(
  'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?',
);
assert.equal(compliance.panel?.compliance?.standard_number, 'IS DEMO 1001:2026');
assert.equal(compliance.panel.compliance.tests.length, 4);
assert.equal(compliance.panel.compliance.documents.length, 4);
assert.equal(compliance.panel.action?.label, 'Start Certification');
assert.ok(compliance.sources.some((source) => source.demo_id === 'STD-DEMO-001'));

const before = await json(`${CLONE}/api/applications`);
const start = await chat(
  'I want to apply for certification for my industrial safety helmet under IS DEMO 1001:2026. Help me complete and submit the application.',
);
assert.match(start.answer, /lab test report/i);
await chat(`NTH-HELMET-${suffix}`);
const review = await chat('I declare that the details and attached test evidence are accurate.');
assert.equal(review.uiMode, 'confirm');
assert.deepEqual(review.panel.confirmTable.missing, []);

const submitted = await chat('Confirm', {
  confirmSubmit: true,
  confirmFields: review.panel.confirmTable.fields,
});
const referenceId = submitted.panel?.record_id;
assert.match(referenceId, /^BIS-APP-DEMO-\d{6}$/);

const persisted = await json(`${CLONE}/api/applications?reference_id=${referenceId}`);
assert.equal(persisted.length, 1);
assert.equal(persisted[0].status, 'Submitted');
assert.equal(persisted[0].owner_session_id, sessionId);
assert.equal(persisted[0].is_number, 'IS DEMO 1001:2026');
assert.equal(persisted[0].status_history.length, 1);
assert.equal((await json(`${CLONE}/api/applications`)).length, before.length + 1);

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
assert.equal(workflow.status_history.at(-1).changed_by, 'Proof BIS Certification Officer');

const alerts = await json(
  `${ADMIN}/api/agent/alerts?sessionId=${encodeURIComponent(sessionId)}&userId=${userId}`,
);
const approval = alerts.alerts.find((alert) => alert.title.startsWith('Certification Approved'));
assert.ok(approval, 'certification approval alert missing');
assert.equal(approval.evidence.changed_by, 'Proof BIS Certification Officer');

const status = await chat(`What is the status of my certification application ${referenceId}?`);
assert.equal(status.panel?.status, 'Certified');
assert.ok(status.panel.status_history.length >= 4);

console.log(JSON.stringify({
  ok: true,
  cluster: CLUSTER,
  standard: compliance.panel.compliance.standard_number,
  referenceId,
  finalStatus: status.panel.status,
  sourceCount: compliance.sources.length,
  timelineEvents: status.panel.status_history.length,
  approvalAlert: approval.title,
}, null, 2));
