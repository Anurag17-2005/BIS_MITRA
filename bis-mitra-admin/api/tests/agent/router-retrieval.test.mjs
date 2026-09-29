/**
 * Router + Retrieval layer tests (17 cases from spec).
 */
import { routeQuery } from '../../agent/router/router.js';
import { resolveQueryWithContext } from '../../agent/router/context.js';
import { retrieve } from '../../retrieval/unified.js';
import { extractIdentifiers } from '../../retrieval/identifiers.js';

const CLUSTER = process.env.TEST_CLUSTER || 'demo-pipeline-2';
let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}${detail ? `: ${detail}` : ''}`);
    failed++;
  }
}

// --- Router tests (no index required) ---
assert('1. IS lookup routes to knowledge', routeQuery('Tell me about IS DEMO 1001').intent === 'knowledge');
assert('2. QCO lookup routes to knowledge', routeQuery('What QCO applies to helmets?').intent === 'knowledge');
assert('3. Licence lookup routes status engine when active check', routeQuery('Is this licence active? CM/L 4151999').intent === 'status' && routeQuery('Is this licence active? CM/L 4151999').useRulesEngine);
assert('4. HUID lookup routes validation engine', routeQuery('Verify HUID HUID-DM26-A71KQ9').intent === 'validation' && routeQuery('Verify HUID HUID-DM26-A71KQ9').useRulesEngine);
assert('5. Lab lookup routes knowledge', routeQuery('Find testing lab LAB-DEMO').intent === 'knowledge');
assert('10. Calculation routing', routeQuery('Calculate certification fee for helmet').intent === 'calculation');
assert('11. Verification routing', routeQuery('Verify registry CM/L 4151999').intent === 'verification');
assert('12. Alert routing', routeQuery("Show today's alerts").intent === 'alert');
assert('13. Workflow routing', routeQuery('Apply for certification step by step').intent === 'task');
assert('14. Comparison routing', routeQuery('Compare these two standards revision diff').intent === 'comparison');

// Context follow-up
const ctx = resolveQueryWithContext('What QCO applies to it?', [
  { role: 'user', text: 'Tell me about IS DEMO 1001' },
]);
assert('17. Conversation follow-up resolves pronoun', ctx.isFollowUp && ctx.query.includes('IS DEMO'));

// Identifier extraction
const ids = extractIdentifiers('ENF-DEMO-001 CMP-DEMO-4401');
assert('Identifiers extract case IDs', ids.caseIds.length >= 1);

// --- Retrieval tests (require live index + clone API) ---
async function retrievalTests() {
  try {
    const r1 = await retrieve('IS DEMO 1001:2026', { clusterId: CLUSTER, topK: 3 });
    assert('1b. Exact IS retrieval has evidence', !r1.insufficient_evidence || r1.records.length > 0,
      r1.retrieval_type);

    const r2 = await retrieve('QCO helmet mandatory', { clusterId: CLUSTER, topK: 5 });
    assert('2b. QCO knowledge question', r2.chunks.length > 0 || r2.records.length > 0, r2.retrieval_type);

    const r3 = await retrieve('CML-DEMO-61001', { clusterId: CLUSTER });
    assert('3b. Licence/CML lookup', r3.records.length > 0 || r3.chunks.length > 0, r3.retrieval_type);

    const r4 = await retrieve('HUID-DM26-A71KQ9', { clusterId: CLUSTER });
    assert('4b. HUID lookup', r4.records.length > 0 || r3.retrieval_type === 'exact_lookup', r4.retrieval_type);

    const r5 = await retrieve('electrical testing lab', { clusterId: CLUSTER });
    assert('5b. Lab lookup', r5.chunks.length > 0 || r5.records.length > 0, r5.retrieval_type);

    const r6 = await retrieve('Which standard applies to safety helmets?', { clusterId: CLUSTER });
    assert('6. Knowledge question', r6.chunks.length > 0, r6.retrieval_type);

    const r7 = await retrieve('safety helmet', { clusterId: CLUSTER });
    assert('7. Synonym query', r7.chunks.length > 0 || r7.answer_context?.expandedTerms?.length > 0, r7.retrieval_type);

    const r8 = await retrieve('IS DEMO 1001 QCO certification lab', { clusterId: CLUSTER });
    assert('8. Cross-domain query', r8.chunks.length > 0 || r8.records.length > 0, r8.retrieval_type);

    const r9 = await retrieve('सुरक्षा हेलमेट मानक', { clusterId: CLUSTER });
    const hindiOk = r9.chunks.length > 0 || r9.insufficient_evidence;
    assert('9. Hindi query (no false claims if no evidence)', hindiOk, r9.retrieval_type);

    const r15 = await retrieve('xyznonexistent product standard 99999', { clusterId: CLUSTER });
    assert('15. No-result query', r15.insufficient_evidence || r15.confidence < 0.5, r15.retrieval_type);

    const r16 = await retrieve('IS DEMO 1001', { clusterId: CLUSTER });
    const hasProv = r16.provenance?.some(p => p.demo_id || p.source_file || p.chunkId);
    assert('16. Source/provenance preservation', hasProv, JSON.stringify(r16.provenance?.[0]));

  } catch (e) {
    console.log(`⚠ Retrieval tests skipped or partial: ${e.message}`);
  }
}

await retrievalTests();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
