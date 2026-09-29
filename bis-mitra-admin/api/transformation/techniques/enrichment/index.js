import { enrichDraft } from './metadata.js';

export function applyEnrichment(item, draft) {
  return enrichDraft(item, draft);
}
