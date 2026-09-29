import { sanitizeExtractedText } from './indic-sanitize.js';

/**
 * Whitespace, control chars, repeated newlines, PDF/CJK extraction garbage.
 */
export function cleanupText(text) {
  if (!text) return '';
  const base = text
    .replace(/\r\n/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  return sanitizeExtractedText(base);
}
