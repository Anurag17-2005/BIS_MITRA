/**
 * Decide whether a user message needs RAG / probes, or is meta/chitchat.
 */

import { SCORE_POLICY } from '../retrieval/score-policy.js';

const META_RE = /^(hi|hello|hey|namaste|thanks|thank\s+you|ok|okay|bye)\b/i;
const ABOUT_RE = /\b(who\s+are\s+(you|u)|what\s+are\s+(you|u)|what\s+can\s+(you|u)\s+do|what\s+(you|u)\s+can\s+do|how\s+(do|can)\s+(you|u)\s+(answer|work|help)|(?:you|u)r?\s+(name|model|role)|introduce\s+yourself|who\s+(r|are)\s+u|model\s+are\s+(you|u))\b/i;
const CAPABILITIES_RE = /\b(what\s+can\s+(you|u)|what\s+(you|u)\s+can|how\s+can\s+(you|u)\s+help|your\s+capabilities|what\s+do\s+(you|u)\s+know|which\s+model|tell\s+me\s+what\s+(you|u)\s+can)\b/i;

/** Looks like a real BIS / standards question */
const DOMAIN_RE = /\b(IS\s*\d+|QCO|SIT|STI|hallmark|BIS|standard|fee|kharcha|mandatory|voluntary|licence|license|certif|lab|manual|complaint|gazette|scheme|CRS|ISI|marking|factory|test|product|helmet|geyser|bicycle|gold|milk)\b/i;

export function classifyIntent(query) {
  const q = String(query || '').trim();
  if (!q) return { intent: 'empty', useRag: false, useProbe: false, useLive: false };

  if (META_RE.test(q) && q.split(/\s+/).length <= 4) {
    return { intent: 'greeting', useRag: false, useProbe: false, useLive: false };
  }
  if (ABOUT_RE.test(q) || CAPABILITIES_RE.test(q)) {
    return { intent: 'about', useRag: false, useProbe: false, useLive: false };
  }
  // Short follow-ups with no domain words → chat only (use history)
  if (!DOMAIN_RE.test(q) && q.length < 40 && !/\?/.test(q) === false) {
    // keep going — questions without domain may still need RAG
  }
  if (!DOMAIN_RE.test(q) && q.split(/\s+/).length <= 6 && /^(can you|could you|please|tell me about yourself)/i.test(q)) {
    return { intent: 'about', useRag: false, useProbe: false, useLive: false };
  }

  return { intent: 'domain', useRag: true, useProbe: true, useLive: true };
}

export function metaAnswer(intent, persona = 'consumer') {
  if (intent === 'greeting') {
    return persona === 'industry'
      ? 'Hello — I am BIS MITRA. Ask about an IS number, QCO status, fees, labs, manuals, or hallmarking.'
      : 'Hi! I am BIS MITRA. Ask me about BIS standards, mandatory products, fees, labs, or hallmarking — in simple words.';
  }

  return `I am **BIS MITRA**, a digital assistant for Bureau of Indian Standards topics.

**What I can do**
- Explain Indian Standards (IS numbers) in plain or expert language
- Say if something looks **mandatory / voluntary** under a QCO (when we have that data)
- Help with marking fees, product manuals, labs, hallmarking, and consumer complaints
- Cite the documents I used so you can check them

**How I answer**
1. I search our BIS knowledge pack (PDFs / rules we ingested)
2. I may check live clone registries (fees, labs, QCO lists)
3. I write an answer only from that evidence — I do not invent engineering numbers

**What I am not**
- Not a human officer, and not legal advice
- For official decisions, always verify on bis.gov.in / the notifying ministry gazette

Ask something concrete, e.g. “Is bicycle helmet certification mandatory?” or “geyser registration ka kharcha?”`;
}

/**
 * Keep only hits that are relevant enough to show / feed the LLM.
 */
export function filterRelevantHits(query, hits, { minScore = SCORE_POLICY.evidenceFloor, max = 5 } = {}) {
  const qIs = (String(query).match(/IS\s*[\d\s().:]+/gi) || [])
    .map(s => s.replace(/\s+/g, ' ').toUpperCase());
  const scored = (hits || []).map(h => {
    let boost = 0;
    const text = `${h.title || ''} ${h.citation?.citation_anchor || ''} ${(h.isNumbers || []).join(' ')}`.toUpperCase();
    for (const isn of qIs) {
      const core = isn.replace(/IS\s*/i, '').split(/[:\s]/)[0];
      if (core && text.includes(core)) boost += 0.25;
    }
    return { ...h, _rel: (h.score || 0) + boost };
  });

  scored.sort((a, b) => b._rel - a._rel);
  const filtered = scored.filter(h => h._rel >= minScore);
  // If query names an IS, prefer hits that mention it
  if (qIs.length) {
    const matched = filtered.filter(h => {
      const blob = `${h.title || ''} ${(h.isNumbers || []).join(' ')} ${h.citation?.citation_anchor || ''}`.toUpperCase();
      return qIs.some(isn => {
        const core = isn.replace(/IS\s*/i, '').split(/[:\s]/)[0];
        return core && blob.includes(core);
      });
    });
    if (matched.length) return matched.slice(0, max);
  }
  return (filtered.length ? filtered : scored.slice(0, 2)).slice(0, max);
}

export function cleanPreview(text, max = 160) {
  return String(text || '')
    .replace(/\[Context Hierarchy:[^\]]*\]/g, '')
    .replace(/#+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
