/**
 * Optional LLM composer. Prefers Groq; also supports OpenAI / Gemini.
 * Falls back to null so the template persona formatter is used.
 */

import { buildSystemPrompt } from './prompts.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Current Groq production chat default (fast, developer-tier). Override with GROQ_MODEL. */
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-20b';

function buildUserPayload({ query, hits, enforcement, probe, live, history, intent, userProfile }) {
  const parts = [];
  if (userProfile && Object.values(userProfile).some(Boolean)) {
    parts.push('PROFILE (already known — do not ask again):');
    parts.push(JSON.stringify(userProfile));
    parts.push('');
  }

  if (history?.length) {
    parts.push('Recent conversation (for continuity only):');
    history.slice(-4).forEach(m => {
      const t = String(m.text || '').slice(0, 280);
      parts.push(`${m.role}: ${t}`);
    });
    parts.push('');
  }

  parts.push(`User question: ${query}`);
  parts.push(`Intent: ${intent || 'domain'}`);

  if (intent === 'about' || intent === 'greeting') {
    parts.push('\n(No document search was run. Answer from your role description only.)');
    return parts.join('\n');
  }

  if (enforcement) {
    parts.push(`\nENFORCEMENT (trusted registry — prefer this for mandatory/voluntary):`);
    parts.push(JSON.stringify({
      status: enforcement.enforcement_status,
      is_number: enforcement.is_number,
      gazette: enforcement.notifying_gazette_id,
      scheme: enforcement.scheme,
      product: enforcement.product,
      caveat: enforcement.legal_caveat,
    }, null, 0));
  } else {
    parts.push('\nENFORCEMENT: (none matched)');
  }

  if (probe?.data) {
    const slim = JSON.stringify(probe.data).slice(0, 900);
    parts.push(`\nLIVE REGISTRY (${probe.tool || 'probe'}): ${slim}`);
  }
  if (live?.ok) {
    parts.push(`\nLIVE PORTAL scrape (${live.pattern}): ${(live.summary || '').slice(0, 500)}`);
  }

  const passages = (hits || []).slice(0, 4).map((h, i) => {
    const anchor = h.citation?.citation_anchor || h.metadata?.citation_anchor || h.title || 'passage';
    const file = h.title || h.section || '';
    const text = String(h.text || h.textPreview || '')
      .replace(/\[Context Hierarchy:[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);
    const score = typeof h.score === 'number' ? h.score.toFixed(2) : '?';
    return `[${i + 1}] ${anchor}\nFile: ${file}\nRelevance: ${score}\n${text}`;
  }).join('\n\n');

  if (passages) {
    parts.push(`\nCONTEXT passages (may include noise — ignore irrelevant ones):\n${passages}`);
  } else {
    parts.push('\nCONTEXT: (no strong matches — answer from ENFORCEMENT/PROBE only, or say you need a clearer IS/product name)');
  }

  return parts.join('\n');
}

async function callOpenAiCompatible({ url, key, model, system, user, label }) {
  if (!key) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${label} ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGroq({ system, user, model }) {
  return callOpenAiCompatible({
    url: GROQ_URL,
    key: process.env.GROQ_API_KEY,
    model: model || process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    system,
    user,
    label: 'Groq',
  });
}

async function callOpenAI({ system, user, model }) {
  return callOpenAiCompatible({
    url: OPENAI_URL,
    key: process.env.OPENAI_API_KEY,
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    system,
    user,
    label: 'OpenAI',
  });
}

async function callGemini({ system, user, model }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const m = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(`${GEMINI_URL(m)}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('')?.trim() || null;
}

export function llmConfigured() {
  return !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

export function llmProvider() {
  const p = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (p === 'groq' || p === 'openai' || p === 'gemini') return p;
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function llmModelLabel() {
  const provider = llmProvider();
  if (provider === 'groq') return process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  if (provider === 'openai') return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return null;
}

/**
 * Generate answer with LLM, or return null to use template fallback.
 */
export async function composeWithLlm(ctx) {
  const provider = llmProvider();
  if (!provider) return null;

  const system = buildSystemPrompt(ctx.persona, {
    intent: ctx.intent,
    language: ctx.language,
    portalPersona: ctx.portalPersona,
    profile: ctx.userProfile,
    context: null,
  });
  const user = buildUserPayload(ctx);

  try {
    let text = null;
    if (provider === 'groq') text = await callGroq({ system, user });
    else if (provider === 'gemini') text = await callGemini({ system, user });
    else text = await callOpenAI({ system, user });

    if (!text) return null;
    text = text
      .replace(/^#{1,3}\s*Direct answer\s*$/gim, '')
      .replace(/^#{1,3}\s*Key points\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { text, provider, model: llmModelLabel() };
  } catch (err) {
    console.error('[llm]', err.message);
    return { error: err.message, provider, model: llmModelLabel() };
  }
}
