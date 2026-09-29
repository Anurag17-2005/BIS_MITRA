/**
 * Decide whether a user message needs RAG / probes, or is meta/chitchat.
 */

import { SCORE_POLICY } from '../retrieval/score-policy.js';
import { extractIdentifiers } from '../retrieval/identifiers.js';

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
const STOPWORDS = new Set(`a an the and or but for nor with without from into onto about above below over under of to in on at by as is are was were be been being am
do does did doing have has had having i me my we our you your he she it its they them their this that these those there here what which who whom whose
when where why how can could should would will shall may might must want need like please help tell give show get make let know also just only
any some all each every more most other such than then too very not no yes if so because while till until again further once own same few both
one two new use used using per via etc kya hai ka ki ke ko se mein aur
explain describe list find search check tell know understand mean means meaning work works steps step guide guidance about
simple simply easy brief briefly short detail detailed overview summary summarise summarize words plain
लिए कौन क्या हैं मुझे मेरे मेरा मेरी कैसे करें करना चाहिए होता होती होगा लागू बताइए बताओ बताएं सकता सकते इसके उसके किस`.split(/\s+/));

/** Domain words that appear in almost every BIS chunk — they cannot prove topical relevance. */
const GENERIC_DOMAIN = new Set(`bis bureau indian standard standards india certification certificate certified certify licence license licensing
product products mandatory voluntary required requirement requirements process procedure scheme apply application document documents
test tests testing information details rule rules detail regarding related qco quality control order orders
manufacture manufacturer manufacturing manufacturers company business applies apply applicable`.split(/\s+/));

export function queryContentTokens(query, extraTerms = []) {
  const blob = [query, ...extraTerms].join(' ').toLowerCase();
  const tokens = blob.match(/[a-z0-9\u0900-\u097f]{3,}/g) || [];
  return [...new Set(tokens.filter(t => !STOPWORDS.has(t) && !GENERIC_DOMAIN.has(t)))];
}

function hitBlob(h) {
  return [
    h.title, h.section, h.text?.slice(0, 2000), h.textPreview, (h.isNumbers || []).join(' '),
    h.metadata?.demo_id, h.metadata?.product, h.metadata?.is_number, (h.layman_synonyms || []).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Keep only hits that are relevant enough to show / feed the LLM.
 * A hit must clear the score floor AND share at least one topical term with the query
 * (or be a very strong semantic match). No forced fallback — empty is better than wrong.
 */
export function filterRelevantHits(query, hits, {
  minScore = SCORE_POLICY.evidenceFloor,
  max = 5,
  expandedTerms = [],
} = {}) {
  const qIs = (String(query).match(/IS\s*(?:DEMO\s*)?\d{1,5}/gi) || [])
    .map(s => s.replace(/\s+/g, ' ').toUpperCase());
  const contentTokens = queryContentTokens(query, expandedTerms);
  const scored = (hits || []).map(h => {
    let boost = 0;
    const text = `${h.title || ''} ${h.citation?.citation_anchor || ''} ${(h.isNumbers || []).join(' ')} ${h.metadata?.is_number || ''}`.toUpperCase();
    for (const isn of qIs) {
      const core = isn.replace(/IS\s*(DEMO\s*)?/i, '').split(/[:\s]/)[0];
      if (core && text.includes(core)) boost += 0.25;
    }
    const blob = hitBlob(h);
    const overlap = contentTokens.filter(t => blob.includes(t)).length;
    return { ...h, _rel: (h.score || 0) + boost, _overlap: overlap, _isMatch: boost > 0 };
  });

  scored.sort((a, b) => b._rel - a._rel);
  // One shared word (e.g. "safety") is not enough when the query names several topical terms.
  const queryTermCount = queryContentTokens(query).length;
  const minOverlap = queryTermCount >= 4 ? 2 : 1;
  const filtered = scored.filter(h => h._rel >= minScore
    && (h._isMatch || !contentTokens.length || h._overlap >= minOverlap || (h.score || 0) >= SCORE_POLICY.strongEvidence));
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
  return filtered.slice(0, max);
}

export function cleanPreview(text, max = 160) {
  return String(text || '')
    .replace(/\[Context Hierarchy:[^\]]*\]/g, '')
    .replace(/#+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
