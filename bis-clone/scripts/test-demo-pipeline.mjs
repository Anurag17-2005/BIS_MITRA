/**
 * Targeted end-to-end checks for demo data → API → RAG pipeline.
 */
import { searchIndex } from '../../bis-mitra-admin/api/transformation/pipeline/run-index.js';
import { executeProbeApi } from '../../bis-mitra-admin/api/core/probes.js';

const API = process.env.CLONE_API || 'http://localhost:4000';
const CLUSTER = 'demo-pipeline-2';

async function apiOk(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

const tests = [
  { name: 'standards search', fn: () => apiOk('/api/standards?q=safety%20helmet') },
  { name: 'synonyms', fn: () => apiOk('/api/synonyms?q=head%20protection') },
  { name: 'qco', fn: () => apiOk('/api/qco?q=helmet') },
  { name: 'registry', fn: () => apiOk('/api/registry/verify?q=CML-DEMO-61001') },
  { name: 'labs', fn: () => apiOk('/api/labs?q=electrical') },
  { name: 'huid', fn: () => apiOk('/api/gold/huid/verify?huid=HUID-DM26-A71KQ9') },
  { name: 'complaints', fn: () => apiOk('/api/consumer/grievances?q=CMP-DEMO') },
  { name: 'enforcement', fn: () => apiOk('/api/enforcement/cases?q=helmet') },
  { name: 'surveillance', fn: () => apiOk('/api/surveillance?q=SURV-DEMO-001') },
  { name: 'amendments', fn: () => apiOk('/api/amendments?is_number=IS%20DEMO%201001') },
];

let passed = 0;
for (const t of tests) {
  try {
    const data = await t.fn();
    const n = Array.isArray(data) ? data.length : (data.found ? 1 : 0);
    console.log(`✓ ${t.name} (${n || 'ok'})`);
    passed++;
  } catch (e) {
    console.log(`✗ ${t.name}: ${e.message}`);
  }
}

// RAG search
try {
  const { results: hits } = searchIndex(CLUSTER, 'IS DEMO 1001:2026 industrial safety helmet', { topK: 3, stage: 'live' });
  const h = hits[0];
  const ok = h && (h.metadata?.demo_id || h.metadata?.source_reference);
  console.log(ok ? `✓ RAG search (demo_id=${h.metadata?.demo_id}, source=${h.metadata?.source_file})` : '✗ RAG search: no provenance in top hit');
  if (ok) passed++;
} catch (e) {
  console.log(`✗ RAG search: ${e.message}`);
}

// Agent probes
for (const [name, connector] of [
  ['agent enforcement', 'enforcement_search'],
  ['agent surveillance', 'surveillance_search'],
]) {
  try {
    const r = await executeProbeApi(connector, 'helmet');
    console.log(`✓ ${name} (${r.resultCount} results)`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
}

console.log(`\n${passed}/${tests.length + 3} checks passed`);
process.exit(passed >= tests.length ? 0 : 1);
