/** Post-process STT output for Hindi / English / mixed sentences. */
export function normalizeTranscript(text, { languageMode = 'auto' } = {}) {
  let out = String(text || '')
    .replace(/\u200b/g, '')
    .replace(/[\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Common Whisper / ASR artifacts
  out = out.replace(/^\s*(thank you for watching\.?|subscribe\.?)\s*$/i, '');
  out = out.replace(/\s+\./g, '.');

  if (languageMode === 'hi' && out && !/[\u0900-\u097F]/.test(out)) {
    // If user forced Hindi but model returned Latin-only, keep text (may be proper nouns)
  }

  return out.trim();
}

export function mergeTranscriptParts(existing, addition, { interim = false } = {}) {
  const base = String(existing || '').trim();
  const add = String(addition || '').trim();
  if (!add) return base;
  if (!base) return add;
  if (interim) return `${base} ${add}`.trim();
  if (base.endsWith(add) || base.includes(add)) return base;
  return `${base} ${add}`.trim();
}
