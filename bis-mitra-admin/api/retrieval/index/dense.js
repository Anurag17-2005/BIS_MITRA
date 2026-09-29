/**
 * Dense embeddings via improved hashing trick (no external ML deps).
 * Char n-grams + token bigrams + IS-number / concept features for paraphrase recall.
 */

import { normalizeSearchText, normalizedCharSource, tokenize } from './tfidf.js';

const DIM = 384;

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addFeature(vec, key, weight = 1) {
  const h = hashString(key);
  const idx = h % DIM;
  const sign = (h & 1) ? 1 : -1;
  vec[idx] = (vec[idx] || 0) + sign * weight;
}

function charNgrams(text, n = 3) {
  const s = ` ${normalizedCharSource(text)} `;
  const grams = [];
  for (let i = 0; i <= s.length - n; i++) grams.push(s.slice(i, i + n));
  return grams;
}

/**
 * Embed text into a fixed dense sparse object {i: weight}.
 */
export function embedText(text) {
  const vec = {};
  const raw = normalizeSearchText(text);
  if (!raw.trim()) return vec;

  const tokens = tokenize(text);

  for (const t of tokens) {
    addFeature(vec, `w:${t}`, t.length > 2 ? 1 : 0.6);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    addFeature(vec, `b:${tokens[i]}_${tokens[i + 1]}`, 1.2);
  }
  for (const g of charNgrams(raw, 3)) addFeature(vec, `g3:${g}`, 0.45);
  for (const g of charNgrams(raw, 4)) addFeature(vec, `g4:${g}`, 0.3);
  for (const g of charNgrams(raw, 5)) addFeature(vec, `g5:${g}`, 0.2);

  // IS numbers as strong anchors
  const isMatches = raw.match(/is\s*\d+(?:\s*[:.]\s*\d+)?/gi) || [];
  for (const isn of isMatches) {
    addFeature(vec, `is:${isn.replace(/\s+/g, '')}`, 3);
  }

  const CONCEPTS = {
    safety: /\b(safe|accident|hazard|protect|injury|permissible|operational\s+safety)\b/,
    factory: /\b(factory|plant|workshop|floor|production|manufactur)\b/,
    testing: /\b(test|inspect|verify|assay|lab|machinery|hydrostatic)\b/,
    fee: /\b(fee|cost|kharcha|charge|payment|licence\s+fee)\b/,
    mandatory: /\b(mandatory|compulsory|qco|gazette|enforce)\b/,
    hallmark: /\b(hallmark|ahc|gold|jewellery|shudhata|nakli)\b/,
    consumer: /\b(complaint|consumer|buyer|retail)\b/,
  };
  for (const [name, re] of Object.entries(CONCEPTS)) {
    if (re.test(raw)) addFeature(vec, `c:${name}`, 2.5);
  }

  let norm = 0;
  for (const v of Object.values(vec)) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const k of Object.keys(vec)) vec[k] /= norm;
  return vec;
}

export function denseSimilarity(a, b) {
  let dot = 0;
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (!aKeys.length || !bKeys.length) return 0;
  const keys = aKeys.length <= bKeys.length ? aKeys : bKeys;
  const other = aKeys.length <= bKeys.length ? b : a;
  const self = aKeys.length <= bKeys.length ? a : b;
  for (const k of keys) {
    if (other[k]) dot += self[k] * other[k];
  }
  return Math.max(0, dot);
}

export const DENSE_DIM = DIM;
