import { cleanupText } from './text-cleanup.js';
import { normalizeIsNumbers } from './is-number.js';

export function applyNormalization(draft) {
  let text = cleanupText(draft.text);
  const { text: withIs, isNumbers } = normalizeIsNumbers(text);
  return {
    ...draft,
    text: withIs,
    isNumbers: [...new Set([...(draft.isNumbers || []), ...isNumbers])],
  };
}
