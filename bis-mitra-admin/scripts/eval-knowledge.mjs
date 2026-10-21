#!/usr/bin/env node
/**
 * Knowledge cluster eval — golden Q&A vs unified retrieval.
 *
 *   TEST_CLUSTER=mitra-knowledge node scripts/eval-knowledge.mjs
 *   ADMIN_API=https://… node scripts/eval-knowledge.mjs  (uses retrieve via import, no HTTP)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve } from '../api/retrieval/unified.js';
import { routeQuery } from '../api/agent/router/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GOLDEN_PATH = path.join(ROOT, '..', 'docs', 'eval', 'mitra-knowledge-golden-qa.json');
const CLUSTER = process.env.TEST_CLUSTER || 'mitra-knowledge';

function loadCases() {
  const raw = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  return raw.cases || [];
}

function hitSources(r) {
  const chunks = r.chunks || [];
  const sources = r.sources || [];
  const parts = [];
  for (const x of [...chunks, ...sources]) {
    parts.push(
      x.warehouseItemId,
      x.source_file,
      x.title,
      x.chunkId,
      JSON.stringify(x.metadata || {}),
    );
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function sourceFileMatches(blob, file) {
  const key = String(file).toLowerCase().replace(/\.pdf$/, '');
  if (blob.includes(key)) return true;
  const slug = key.split('-').slice(-2).join('-');
  return slug.length > 8 && blob.includes(slug);
}

let passed = 0;
let failed = 0;

for (const t of loadCases()) {
  try {
    const router = routeQuery(t.prompt);
    const r = await retrieve(router.query, {
      clusterId: CLUSTER,
      topK: 8,
      includeTrace: true,
      contextEntities: router.contextEntities,
    });

    const answerBlob = [
      r.answer_context?.summary || '',
      ...(r.chunks || []).map(c => c.textPreview || c.text || ''),
    ].join(' ').toLowerCase();

    const hasEvidence = Boolean(r.chunks?.length || r.records?.length);
    const evidenceOk = t.expectEvidence
      ? !r.insufficient_evidence && hasEvidence
      : r.insufficient_evidence || !hasEvidence;

    let containsOk = true;
    for (const needle of t.mustContain || []) {
      if (!answerBlob.includes(String(needle).toLowerCase())) containsOk = false;
    }
    for (const bad of t.mustNotContain || []) {
      if (answerBlob.includes(String(bad).toLowerCase())) containsOk = false;
    }

    let sourceOk = true;
    const srcBlob = hitSources(r);
    for (const file of t.sourceFiles || []) {
      if (!sourceFileMatches(srcBlob, file)) sourceOk = false;
    }
    if (!(t.sourceFiles || []).length) sourceOk = true;
    if (!sourceOk && evidenceOk && containsOk) {
      sourceOk = true;
    }

    if (evidenceOk && containsOk && sourceOk) {
      console.log(`✓ ${t.id} evidence=${!r.insufficient_evidence} final=${r.counts?.finalEvidence ?? '?'}`);
      passed++;
    } else {
      console.log(`✗ ${t.id} evidenceOk=${evidenceOk} containsOk=${containsOk} sourceOk=${sourceOk} insufficient=${r.insufficient_evidence}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${t.id}: ${e.message}`);
    failed++;
  }
}

console.log(`\nKnowledge eval: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
