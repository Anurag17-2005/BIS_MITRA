/**
 * Live citizen complaint flow on the sandbox: guided intake → confirm table → grievance submission.
 * Run: node api/tests/agent/complaint-flow.test.mjs   (admin on :5050)
 */
import assert from 'node:assert/strict';

const ADMIN = process.env.ADMIN_API || 'http://localhost:5050';
const CLUSTER = process.env.TEST_CLUSTER || 'proof-actions-sandbox';
const suffix = `${Date.now()}`.slice(-6);
const sessionId = `complaint-test-${suffix}`;

async function chat(message, extra = {}) {
  const res = await fetch(`${ADMIN}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      clusterId: CLUSTER,
      personaMode: 'auto',
      userPersona: 'citizen',
      sessionId,
      userId: 'citizen',
      language: 'en',
      conversationId: `complaint-${suffix}`,
      ...extra,
    }),
  });
  const body = await res.json();
  assert.equal(res.ok, true, body.error);
  return body;
}

const start = await chat('I want to file a consumer complaint');
assert.match(start.answer, /which product/i);
assert.doesNotMatch(start.answer, /induction|helmet/i);

assert.match((await chat('Prestige pressure cooker 5L with a fake ISI mark')).answer, /shop|seller|website/i);
assert.match((await chat('Sharma Electronics, Pune')).answer, /bill|invoice/i);
const issueQ = await chat('Bill number INV-88231');
assert.match(issueQ.answer, /what (?:is wrong|happened|went wrong)|problem|issue/i);

const review = await chat('The ISI mark looks printed on a sticker and the lid does not seal');
assert.equal(review.uiMode, 'confirm');
const table = review.panel.confirmTable;
assert.deepEqual(table.missing, []);
assert.match(table.fields.product, /pressure cooker/i);
assert.match(table.fields.seller, /Sharma Electronics/i);
assert.match(table.fields.bill, /INV-88231/);
assert.match(table.fields.issue, /sticker|seal/i);

const submitted = await chat('Confirm', { confirmSubmit: true, confirmFields: review.panel.confirmTable.fields });
const ref = submitted.panel?.record_id || submitted.panel?.ticket_id;
assert.ok(ref, `no complaint reference returned: ${submitted.answer}`);
assert.doesNotMatch(submitted.answer, /Form-I|certification application/i);

const tracked = await chat(`What is the status of my complaint ${ref}?`);
assert.equal(tracked.router?.intent, 'workflow_status');
assert.ok(tracked.answer.includes(ref) || tracked.panel?.record_id === ref, `tracking did not find ${ref}: ${tracked.answer}`);

console.log(JSON.stringify({
  reference: ref,
  status: submitted.panel?.status,
  tracked: tracked.answer.replace(/\s+/g, ' ').slice(0, 220),
}, null, 2));
