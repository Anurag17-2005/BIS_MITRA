import assert from 'node:assert/strict';

export function assertCompliance(panel, { standard = 'IS DEMO 1001:2026', tests = 4, docs = 4 } = {}) {
  assert.equal(panel?.compliance?.standard_number, standard);
  assert.equal(panel.compliance.tests.length, tests);
  assert.equal(panel.compliance.documents.length, docs);
  assert.equal(panel.action?.label, 'Start Certification');
}

export function assertChecklist(panel, { standard, qcoPattern }) {
  assert.equal(panel?.checklist?.standard, standard);
  if (qcoPattern) assert.match(panel.checklist.qco, qcoPattern);
  assert.ok(panel.checklist.documents.length >= 3);
}

export function assertMatching(panel) {
  assert.ok(panel?.matching?.recommended);
}

export function assertVerification(panel, { found = true, identifierPattern }) {
  assert.equal(panel?.verification?.found, found);
  if (identifierPattern) assert.match(panel.verification.identifier, identifierPattern);
}

export function assertConfirmReady(review) {
  assert.equal(review.uiMode, 'confirm');
  assert.deepEqual(review.panel.confirmTable.missing, []);
}

export function assertComparison(panel, { oldId, minRows = 2 }) {
  assert.equal(panel?.comparison?.old_standard_id, oldId);
  assert.ok(panel.comparison.rows.length >= minRows);
}

export function assertCase(panel, caseId) {
  assert.equal(panel?.case?.case_id, caseId);
}

export function assertSourcesMin(sources, demoId) {
  assert.ok(Array.isArray(sources));
  if (demoId) assert.ok(sources.some((s) => s.demo_id === demoId), `missing source ${demoId}`);
}
