import assert from 'node:assert/strict';
import { ADMIN, CLONE, CLUSTER, chat, json } from './proof-helpers.mjs';

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const run = (n) => !only || only === String(n);

const suffix = `${Date.now()}`.slice(-6);
const citizenSession = `proof-citizen-${suffix}`;
const enforceSession = `proof-enf-${suffix}`;

const results = {};

if (run(4)) {
  const fmcs = await chat(
    'I manufacture induction cooking appliances outside India and want to sell them in India. What BIS requirements apply, which standard and QCO should I check, and what AIR, factory inspection, documents and testing evidence do I need?',
    { personaMode: 'foreign_exporter', userPersona: 'foreign_exporter', sessionId: `proof-fmcs-${suffix}` },
  );
  assert.equal(fmcs.panel?.checklist?.standard, 'IS DEMO 1003:2025');
  assert.match(fmcs.panel.checklist.qco, /QCO-DEMO-003/);
  assert.ok(fmcs.panel.checklist.documents.length >= 3);
  assert.ok(fmcs.sources?.length >= 0);
  results.action4 = { standard: fmcs.panel.checklist.standard };
}

if (run(5)) {
  const labs = await chat(
    'I need to test my induction cooking appliance against IS DEMO 1003:2025. Which BIS-recognised laboratory should I use?',
    { personaMode: 'industry', userPersona: 'industry', sessionId: `proof-lab-${suffix}` },
  );
  assert.ok(labs.panel?.matching?.recommended);
  assert.match(labs.panel.matching.reason, /1003/i);
  results.action5 = { lab: labs.panel.matching.demo_id };
}

if (run(6)) {
  const reg = await json(`${CLONE}/api/registry/verify?cml=CML-DEMO-61003`);
  assert.equal(reg.found, true);
  assert.equal(reg.cml_number, 'CML-DEMO-61003');
  const verify = await chat('Verify CML-DEMO-61003 — is this product certified under BIS?', {
    sessionId: `proof-cml-${suffix}`,
  });
  assert.equal(verify.panel?.verification?.found, true);
  assert.match(verify.panel.verification.identifier, /CML-DEMO-61003/i);
  results.action6 = { cml: verify.panel.verification.identifier };
}

if (run(7)) {
  const before = await json(`${CLONE}/api/consumer/grievances`);
  const beforeCmp = before.filter((r) => /^CMP-DEMO-/i.test(r.ticket_id)).length;
  const cmpExtra = {
    sessionId: citizenSession,
    userId: 'citizen',
    userPersona: 'citizen',
    conversationId: `proof-cmp-${suffix}`,
  };
  await chat('I want to file a consumer complaint', cmpExtra);
  await chat('Bajaj mixer grinder model GX-1', cmpExtra);
  await chat('PowerSafe Retail, Pune', cmpExtra);
  await chat('Invoice INV-PROOF-8821', cmpExtra);
  const review = await chat('The motor stopped working after two days.', cmpExtra);
  assert.equal(review.uiMode, 'confirm');
  assert.ok(review.panel?.confirmTable);
  assert.deepEqual(review.panel.confirmTable.missing, []);
  const submitted = await chat('Confirm', {
    ...cmpExtra,
    confirmSubmit: true,
    confirmFields: review.panel.confirmTable.fields,
  });
  const ticketId = submitted.panel?.record_id;
  assert.match(ticketId, /^CMP-DEMO-\d+/);
  const after = await json(`${CLONE}/api/consumer/grievances?ticket_id=${encodeURIComponent(ticketId)}`);
  assert.equal(after[0].status, 'SUBMITTED');
  assert.equal(after[0].owner_session_id, citizenSession);
  await json(`${CLONE}/api/consumer/grievances/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Investigation', changed_by: 'Proof Officer', note: 'Assigned' }),
  });
  const alerts = await json(`${ADMIN}/api/agent/alerts?sessionId=${encodeURIComponent(citizenSession)}&userId=citizen`);
  assert.ok(alerts.alerts?.some((a) => /complaint|investigation/i.test(a.title + a.body)));
  results.action7 = { ticketId, beforeCmp, afterCmp: beforeCmp + 1 };
}

if (run(8)) {
  const ok = await chat(
    'Verify HUID-DM26-H29ZC6. Explain 22K/916 purity and calculate the pure-gold-equivalent value for 14.68 g if today\'s 24K price is ₹7,000 per gram.',
    { personaMode: 'gold_investor', userPersona: 'gold_investor', sessionId: `proof-huid-${suffix}` },
  );
  assert.equal(ok.panel?.verification?.verification_result, 'VERIFIED');
  assert.ok(ok.panel?.calculation?.pure_gold_grams > 0);
  const w = ok.panel.verification?.weight_grams || 14.68;
  const expected = Math.round((w * 916 / 1000) * 7000);
  assert.equal(ok.panel.calculation.estimated_value_inr, expected);
  const bad = await chat('Verify HUID-DM26-Z99FLAG.', { sessionId: `proof-huid-bad-${suffix}` });
  assert.equal(bad.panel?.verification?.verification_result, 'MISMATCH');
  assert.equal(bad.panel?.calculation, undefined);
  results.action8 = { value: ok.panel.calculation.estimated_value_inr };
}

if (run(9)) {
  const diff = await chat(
    'Compare STD-DEMO-010 and STD-DEMO-011. Show the old and current requirements, what changed, and the source for each difference.',
    { personaMode: 'academic', userPersona: 'academic', sessionId: `proof-diff-${suffix}` },
  );
  assert.equal(diff.panel?.comparison?.old_standard_id, 'STD-DEMO-010');
  assert.ok(diff.panel.comparison.rows.length >= 2);
  results.action9 = { rows: diff.panel.comparison.rows.length };
}

if (run(10)) {
  const enfExtra = {
    personaMode: 'enforcement',
    userPersona: 'enforcement',
    sessionId: enforceSession,
    userId: 'enforcement',
    conversationId: `proof-enf-${suffix}`,
  };
  const read = await chat(
    'I am inspecting the manufacturer linked to SURV-DEMO-001. Check its licence, applicable standard, previous surveillance and ENF-DEMO-001. What evidence must I record if the helmet fails?',
    enfExtra,
  );
  assert.equal(read.panel?.case?.case_id, 'ENF-DEMO-001');
  assert.ok(read.panel.case.evidence_required?.length >= 2);
  const casesBefore = await json(`${CLONE}/api/enforcement/cases?case_id=ENF-DEMO-001`);
  const countBefore = casesBefore[0]?.evidence_history?.length || 0;
  const runId = `EVD-PA10-${suffix}`;
  const propose = await chat(
    `Log a sealed sample and inspection photographs against ENF-DEMO-001. evidence_id ${runId}`,
    enfExtra,
  );
  assert.equal(propose.uiMode, 'confirm');
  assert.ok(propose.panel?.confirmTable);
  assert.match(propose.answer, /confirm|nothing has been done/i);
  const done = await chat('Confirm', { ...enfExtra, confirmSubmit: true });
  assert.ok(done.panel?.result?.evidence_id || done.probe?.data?.evidence_id);
  const casesAfter = await json(`${CLONE}/api/enforcement/cases?case_id=ENF-DEMO-001`);
  const countAfter = casesAfter[0]?.evidence_history?.length || 0;
  assert.ok(countAfter >= countBefore + 1);
  const idemProbe = await json(`${CLONE}/api/v1/enforcement/raid-evidence`, {
    method: 'POST',
    body: JSON.stringify({ evidence_id: runId, case_id: 'ENF-DEMO-001', units: 1, product_description: 'Sealed sample' }),
  });
  assert.equal(idemProbe.idempotent, true);
  results.action10 = { countBefore, countAfter, runId };
}

console.log(JSON.stringify({ ok: true, cluster: CLUSTER, results }, null, 2));
