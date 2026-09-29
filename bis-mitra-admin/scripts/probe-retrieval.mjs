/**
 * Print top retrieval candidates and what survives evidence selection.
 * Usage: node scripts/probe-retrieval.mjs [clusterId] "query" ["query" ...]
 */
import { retrieve } from '../api/retrieval/unified.js';

const [cluster, ...queries] = process.argv.slice(2);
for (const q of queries) {
  const r = await retrieve(q, { clusterId: cluster, topK: 6, includeTrace: true });
  const combined = r.trace?.stages?.combined?.candidates || [];
  console.log(`\n=== ${q}`);
  console.log('  top candidates:', combined.slice(0, 5).map((c) => `${(c.score || 0).toFixed(3)} ${c.metadata?.demo_id || c.title || c.chunkId}`).join(' | '));
  console.log(`  kept: ${r.chunks.length} chunks, ${r.records.length} records, type=${r.retrieval_type}`);
  console.log('  kept ids:', r.chunks.map((c) => `${(c.score || 0).toFixed(3)} ${c.demo_id || c.title}`).join(' | '));
}
