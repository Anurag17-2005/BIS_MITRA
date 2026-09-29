/**
 * One live structured-answer call through the real composer. Prints no secrets.
 * Usage: node scripts/llm-smoke.mjs
 */
import { composeWithLlm, llmProvider, llmModelLabel } from '../api/agent/llm.js';
import { groqKeyStatus } from '../api/env.js';

const { present, looksLikeGroq } = groqKeyStatus();
console.log(JSON.stringify({ keyPresent: present, looksLikeGroq, provider: llmProvider(), model: llmModelLabel() }));

const result = await composeWithLlm({
  query: 'Is certification mandatory for portable induction cookers, and which standard applies?',
  intent: 'knowledge',
  persona: 'industry',
  portalPersona: 'industry',
  language: 'en',
  hits: [{
    title: 'IS DEMO 1003:2025 — Domestic Induction Cooking Appliances - Safety and Performance',
    text: 'IS DEMO 1003:2025 covers domestic induction cooking appliances. Tests: electrical safety, temperature rise, EMC. Documents: test report from BIS-recognised lab, factory quality plan.',
    metadata: { demo_id: 'STD-DEMO-003', is_number: 'IS DEMO 1003:2025' },
  }],
  enforcement: { enforcement_status: 'MANDATORY', is_number: 'IS DEMO 1003:2025', product: 'portable induction cookers', scheme: 'Scheme-I' },
});

console.log(JSON.stringify({
  ok: !!result?.text,
  error: result?.error || null,
  errorKind: result?.errorKind || null,
  structured: result?.structured,
  citedEvidence: result?.citedEvidence,
  suggestedCta: result?.suggestedCta,
  latency_ms: result?.latency_ms,
  usage: result?.usage ? { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens } : null,
}, null, 2));
console.log('\n--- rendered answer ---\n' + (result?.text || '(none)'));
