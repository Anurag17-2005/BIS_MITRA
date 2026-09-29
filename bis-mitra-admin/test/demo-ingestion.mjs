#!/usr/bin/env node
/**
 * Verify demo dataset ingestion: Clone source → Admin fetch → Warehouse → Golden.
 * Requires bis-clone API on :4000 (or seeded SQLite for db method fallback).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStore, saveStore } from '../api/store.js';
import { runPlanInternal } from '../api/runner-core.js';
import { processWarehouseItem } from '../api/transformation/pipeline/run-golden.js';
import { createDedupRegistry } from '../api/transformation/techniques/deduplication/index.js';
import { DEMO_INGEST_CONNECTORS } from '../api/connectors/demo-ingest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLUSTER_ID = process.env.TEST_CLUSTER_ID || 'demo-pipeline-2';
const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

const PLAN_BASES = [
  'ingest_demo_standards',
  'ingest_demo_qco',
  'ingest_demo_certification',
  'ingest_demo_laboratories',
  'ingest_demo_hallmarking_huid',
  'ingest_demo_consumer_complaints',
  'ingest_demo_enforcement',
  'ingest_demo_surveillance',
];

async function apiReachable() {
  try {
    const res = await fetch(`${CLONE_API}/api/news`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function planId(base) {
  return `${CLUSTER_ID}_${base}`;
}

async function runIngestTest(store, baseId) {
  const plan = store.plans.find(p => p.id === planId(baseId));
  if (!plan) return { baseId, ok: false, error: 'plan not found' };

  const before = store.warehouse.filter(w => w.planId === plan.id).length;
  const { historyEntry } = await runPlanInternal(store, plan.id);
  const items = store.warehouse.filter(w => w.planId === plan.id && w.source !== 'upload');

  const checks = {
    fetchStarted: true,
    stored: historyEntry.storedInWarehouse || items.length > 0,
    itemCount: items.length,
    allHaveSha: items.every(w => w.catalog?.content_sha256),
    allHaveFetchId: items.every(w => w.catalog?.fetch_id),
    allHaveDemoId: items.every(w => w.meta?.demo_id || w.content?.demo_id),
    unchangedSkip: historyEntry.unchanged === true,
  };

  const ok = checks.itemCount > 0 && checks.allHaveSha && checks.allHaveFetchId && checks.allHaveDemoId;

  // Golden smoke: process first item
  let goldenOk = false;
  if (items[0]) {
    const dedup = createDedupRegistry();
    const out = await processWarehouseItem(items[0], dedup);
    goldenOk = !out.quarantined && (out.record?.text || '').length > 0;
  }

  // Re-run unchanged detection
  let unchangedOk = false;
  if (ok && !historyEntry.unchanged) {
    const snap = JSON.parse(JSON.stringify(store));
    const second = await runPlanInternal(snap, plan.id);
    unchangedOk = second.historyEntry.unchanged === true;
    if (unchangedOk) Object.assign(store, snap);
  } else if (historyEntry.unchanged) {
    unchangedOk = true;
  }

  return {
    baseId,
    connector: plan.connector,
    ok,
    goldenOk,
    unchangedOk,
    before,
    after: items.length,
    checks,
    error: ok ? null : 'warehouse validation failed',
  };
}

async function main() {
  console.log('Demo ingestion test — cluster:', CLUSTER_ID);
  const reachable = await apiReachable();
  console.log(reachable ? '✓ Clone API reachable' : '⚠ Clone API not reachable — db method may still work for some connectors');

  const store = getStore();
  const results = [];

  for (const base of PLAN_BASES) {
    try {
      const r = await runIngestTest(store, base);
      results.push(r);
      const mark = r.ok && r.goldenOk ? '✓' : '✗';
      console.log(`${mark} ${base}: ${r.after} items, golden=${r.goldenOk}, unchanged=${r.unchangedOk}`);
      if (r.error) console.log('   ', r.error, r.checks);
    } catch (err) {
      results.push({ baseId: base, ok: false, error: err.message });
      console.log(`✗ ${base}: ${err.message}`);
    }
  }

  saveStore(store);

  const manifestPath = path.join(__dirname, '..', 'data', 'bronze', CLUSTER_ID);
  const bronzeDirs = fs.existsSync(manifestPath)
    ? fs.readdirSync(manifestPath).filter(d => d.startsWith('fetch-')).length
    : 0;

  console.log('\nConnectors registered:', Object.keys(DEMO_INGEST_CONNECTORS).length);
  console.log('Bronze fetch runs on disk:', bronzeDirs);

  const failed = results.filter(r => !r.ok || !r.goldenOk);
  if (failed.length) {
    console.error(`\n${failed.length} dataset(s) failed`);
    process.exit(1);
  }
  console.log('\nAll 8 demo datasets ingested successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
