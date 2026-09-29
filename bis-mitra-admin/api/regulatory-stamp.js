/**
 * Stamp bronze/warehouse rows with legal_status, scheme_type, persona_target.
 * Uses transform regulatory modules (QCO registry + scheme/persona heuristics).
 */
import {
  bestEnforcementForIsList,
  evaluateEnforcementState,
  buildRegulatoryTags,
} from './transformation/techniques/regulatory/index.js';

function collectIsNumbers(item) {
  const found = new Set();
  if (item.meta?.is_number) found.add(item.meta.is_number);
  const blob = JSON.stringify(item.content || item.meta || {}).slice(0, 8000);
  const re = /\bIS\s*\d+(?:\s*\([^)]+\))?(?:\s*:\s*\d{4})?/gi;
  let m;
  while ((m = re.exec(blob))) found.add(m[0].replace(/\s+/g, ' ').trim());
  return [...found];
}

export function stampRegulatoryOnItem(item, plan = null) {
  const isNumbers = collectIsNumbers(item);
  const enforcement = isNumbers.length
    ? bestEnforcementForIsList(isNumbers)
    : evaluateEnforcementState(null);

  const tags = buildRegulatoryTags({
    domain: item.domain || plan?.section,
    text: typeof item.content === 'string' ? item.content : JSON.stringify(item.content || ''),
    title: item.meta?.title || item.name || '',
    isNumbers,
    enforcement,
  });

  item.regulatory = {
    legal_status: tags.legal_status,
    scheme_type: tags.scheme_type,
    persona_target: tags.persona_target,
    enforcement: tags.enforcement,
    is_numbers: isNumbers,
    stamped_at: new Date().toISOString(),
  };

  if (item.catalog) {
    item.catalog.legal_status = tags.legal_status;
    item.catalog.scheme_type = tags.scheme_type;
    item.catalog.persona_target = tags.persona_target;
  }

  return item;
}

export function stampRegulatoryBatch(items, plan = null) {
  return items.map(i => stampRegulatoryOnItem(i, plan));
}
