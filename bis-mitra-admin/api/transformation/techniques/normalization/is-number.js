const IS_PATTERN = /\bIS\s*(\d+(?:\s*\(Part\s*\d+\))?(?::\d{4})?)\b/gi;

/**
 * Normalize IS number mentions to canonical "IS {number}" form.
 */
export function normalizeIsNumbers(text) {
  if (!text) return { text: '', isNumbers: [] };
  const found = new Set();
  const normalized = text.replace(IS_PATTERN, (match, core) => {
    const canonical = `IS ${core.replace(/\s+/g, ' ').trim()}`;
    found.add(canonical);
    return canonical;
  });
  return { text: normalized, isNumbers: [...found] };
}

export function extractIsNumbers(text) {
  const { isNumbers } = normalizeIsNumbers(text || '');
  return isNumbers;
}
