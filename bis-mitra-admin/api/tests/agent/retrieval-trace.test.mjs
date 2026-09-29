/**
 * Retrieval trace debugger — demo query verification.
 */
import { retrieve } from '../../retrieval/unified.js';
import { routeQuery } from '../../agent/router/router.js';

const CLUSTER = process.env.TEST_CLUSTER || 'demo-pipeline-2';

const DEMO_QUERIES = [
  { name: 'Safety helmet knowledge', query: 'Which standard applies to safety helmets?', expectEvidence: true },
  { name: 'Marking fee', query: 'What is the marking fee for IS 15844?', expectEvidence: true },
  { name: 'CML verification', query: 'Is CML-DEMO-61001 active?', expectEvidence: true },
  { name: 'Lab lookup', query: 'Find a testing laboratory for this product.', expectEvidence: true },
  { name: 'Synonym query', query: 'safety helmet head protection', expectEvidence: true },
  { name: 'Cross-domain', query: 'IS DEMO 1001 QCO certification lab', expectEvidence: true },
  { name: 'Hindi query', query: 'सुरक्षा हेलमेट मानक', expectEvidence: null },
  { name: 'No evidence', query: 'Tell me about XYZ123UnknownProduct', expectEvidence: false },
];

let passed = 0;
let failed = 0;

for (const t of DEMO_QUERIES) {
  try {
    const router = routeQuery(t.query);
    const r = await retrieve(router.query, {
      clusterId: CLUSTER,
      topK: 8,
      includeTrace: true,
      contextEntities: router.contextEntities,
    });

    const hasTrace = !!r.trace?.stages;
    const hasCounts = r.counts != null;
    const hasStages = r.trace?.stages?.lexical != null;
    const evidenceOk = t.expectEvidence == null
      ? true
      : (t.expectEvidence ? !r.insufficient_evidence : r.insufficient_evidence);

    if (hasTrace && hasCounts && hasStages && evidenceOk) {
      console.log(`✓ ${t.name} (evidence=${!r.insufficient_evidence}, final=${r.counts.finalEvidence}, latency=${r.latency_ms}ms)`);
      passed++;
    } else {
      console.log(`✗ ${t.name}: trace=${hasTrace} counts=${hasCounts} evidence=${evidenceOk} insufficient=${r.insufficient_evidence}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${t.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${DEMO_QUERIES.length} trace demo queries passed`);
process.exit(failed > 0 ? 1 : 0);
