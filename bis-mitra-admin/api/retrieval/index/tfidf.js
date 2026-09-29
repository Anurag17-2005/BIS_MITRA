const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'is', 'are', 'was', 'be',
  'by', 'at', 'from', 'as', 'that', 'this', 'it', 'not', 'shall', 'may', 'will', 'all', 'any',
]);

/** NFC lowercase; keeps Devanagari and other Unicode letters for indexing. */
export function normalizeSearchText(text) {
  return String(text || '').toLowerCase().normalize('NFC');
}

function isLatinToken(t) {
  return /^[a-z0-9]+$/i.test(t);
}

function minTokenLength(t) {
  return isLatinToken(t) ? 3 : 2;
}

export function tokenize(text) {
  const tokens = normalizeSearchText(text).match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.filter(t => t.length >= minTokenLength(t) && !STOP.has(t));
}

/** Compact string for character n-grams (letters/digits/spaces only). */
export function normalizedCharSource(text) {
  return normalizeSearchText(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const max = Math.max(...Object.values(tf), 1);
  for (const k of Object.keys(tf)) tf[k] = tf[k] / max;
  return tf;
}

export function buildIdf(documents) {
  const df = {};
  const n = documents.length;
  for (const tokens of documents) {
    const seen = new Set(tokens);
    for (const t of seen) df[t] = (df[t] || 0) + 1;
  }
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log((n + 1) / (count + 1)) + 1;
  }
  return idf;
}

export function vectorize(tf, idf) {
  const vec = {};
  for (const [term, weight] of Object.entries(tf)) {
    if (idf[term]) vec[term] = weight * idf[term];
  }
  return vec;
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
