/**
 * Clean PDF extraction noise: CJK mis-mapped glyphs, ghost markers, stutter repeats.
 * Keeps Devanagari, Latin (bilingual BIS docs), digits, and common punctuation.
 */

const GARBAGE_SCRIPT_RE = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/gu;
const PDF_GHOST_RE = /xxxGI\w*xxx/gi;
const DOTTED_CIRCLE = /\u25CC/g;
const ZERO_WIDTH = /[\u200B-\u200F\uFEFF]/g;

/** Allowed after stripping garbage scripts (Latin, Devanagari, digits, punctuation, space). */
const ALLOWED_RE = /[\u0900-\u097F\uA8E0-\uA8FFa-zA-Z0-9\s.,;:!?()\-–—/'"\n\r\t₹°§©®%&+=_#@*/\\[\]{}|~`^]/;

export function assessPdfTextQuality(text = '') {
  const s = String(text);
  const han = (s.match(/\p{Script=Han}/gu) || []).length;
  const dev = (s.match(/[\u0900-\u097F]/g) || []).length;
  const ghosts = PDF_GHOST_RE.test(s);
  const stutter = /\b(\S+)(?:\s+\1){2,}/u.test(s);
  // PDF font bugs: matra/vowel sign at word start (e.g. ािधकार instead of अधिकार)
  const brokenMatra = (s.match(/(?:^|[\s\n])[\u093A-\u094C\u0901-\u0903]/gm) || []).length;
  const corrupt = han > 0 || ghosts || brokenMatra > 2 || (dev > 0 && stutter);
  return { corrupt, hanCount: han, devCount: dev, ghosts, stutter, brokenMatra };
}

export function collapseRepeatedWords(text = '') {
  let s = String(text);
  // PDF stutter: "wordword" or "ख डख ड" glued duplicates
  s = s.replace(/([\u0900-\u097F]{2,})\1+/g, '$1');
  const parts = s.split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of parts) {
    if (out.length && out[out.length - 1] === w) continue;
    out.push(w);
  }
  return out.join(' ');
}

/**
 * Strip mis-encoded CJK and other non-BIS scripts; normalize Devanagari to NFC.
 */
export function sanitizeExtractedText(text = '') {
  if (!text) return '';

  let s = String(text)
    .normalize('NFC')
    .replace(PDF_GHOST_RE, ' ')
    .replace(DOTTED_CIRCLE, '')
    .replace(ZERO_WIDTH, '')
    .replace(GARBAGE_SCRIPT_RE, '');

  // Drop remaining isolated symbols outside allowed set
  s = [...s].map(ch => (ALLOWED_RE.test(ch) ? ch : ' ')).join('');

  s = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  return collapseRepeatedWords(s).trim();
}

export function pickCleanerText(a, b) {
  const sa = sanitizeExtractedText(a);
  const sb = sanitizeExtractedText(b);
  const qa = assessPdfTextQuality(sa);
  const qb = assessPdfTextQuality(sb);
  if (qb.hanCount < qa.hanCount) return { text: sb, source: 'ocr' };
  if (qa.hanCount < qb.hanCount) return { text: sa, source: 'parse' };
  if (sb.length > sa.length * 1.1 && qb.devCount >= qa.devCount) return { text: sb, source: 'ocr' };
  return { text: sa, source: 'parse' };
}
