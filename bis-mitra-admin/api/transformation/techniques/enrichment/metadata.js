import { extractIsNumbers } from '../normalization/is-number.js';
import {
  bestEnforcementForIsList,
  enrichGoldenSynonyms,
  buildRegulatoryTags,
} from '../regulatory/index.js';

/** Demo SIT machinery hints keyed by IS family */
const SIT_MACHINERY = {
  '4151': ['Impact absorption test rig', 'Penetration resistance cone', 'Chin-strap retention tester'],
  '623': ['Frame fatigue test machine', 'Static load bench', 'Alignment gauge'],
  '2082': ['Hydrostatic pressure rig', 'Calibrated pressure display gauge', 'Dielectric strength tester'],
  '2062': ['Universal testing machine', 'Spectrometer for chemistry', 'Bend test fixture'],
  '14543': ['Microbiological incubator', 'TOC analyser', 'Seal integrity tester'],
  '3055': ['Temperature calibration bath', 'Stem diameter gauge'],
  '15844': ['Photometric integrating sphere', 'Electrical safety tester'],
};

function machineryForIs(isNumbers = []) {
  for (const isn of isNumbers) {
    const m = String(isn).match(/IS\s*(\d+)/i);
    if (m && SIT_MACHINERY[m[1]]) return SIT_MACHINERY[m[1]];
  }
  return [];
}

function relatedFromText(text = '') {
  return extractIsNumbers(text).slice(0, 8);
}

export function enrichDraft(item, draft) {
  const title = item.meta?.title
    || item.meta?.is_number
    || item.name?.replace(/[-_]/g, ' ')
    || '';

  const fromTitle = extractIsNumbers(title);
  const fromMeta = item.meta?.is_number ? [item.meta.is_number] : [];
  const fromText = extractIsNumbers((draft.text || '').slice(0, 4000));
  const isNumbers = [...new Set([...(draft.isNumbers || []), ...fromTitle, ...fromMeta, ...fromText])];

  let language = 'en';
  if (/hindi|हिंदी/i.test(draft.text || '') || /hindi/i.test(item.name || '')) {
    language = 'hi';
  }

  const enforcement = item.regulatory?.enforcement
    || bestEnforcementForIsList(isNumbers);
  const tags = buildRegulatoryTags({
    domain: item.domain,
    text: draft.text || '',
    title,
    isNumbers,
    enforcement,
  });

  // Prefer ingest stamps when present
  if (item.regulatory?.legal_status) tags.legal_status = item.regulatory.legal_status;
  if (item.regulatory?.scheme_type) tags.scheme_type = item.regulatory.scheme_type;
  if (item.regulatory?.persona_target) tags.persona_target = item.regulatory.persona_target;

  const synonyms = enrichGoldenSynonyms(`${title}\n${draft.text || ''}`);
  const related = relatedFromText(draft.text || '').filter(x => !isNumbers.includes(x));
  const machinery = machineryForIs(isNumbers);

  let text = draft.text || '';
  const appendix = [];
  if (tags.enforcement?.enforcement_status) {
    appendix.push(
      `# Legal enforcement status`,
      `## ${tags.enforcement.enforcement_status}`,
      `IS: ${tags.enforcement.is_number || isNumbers[0] || 'n/a'}`,
      `Gazette: ${tags.enforcement.notifying_gazette_id || 'n/a'}`,
      `Ministry: ${tags.enforcement.notifying_ministry || 'n/a'}`,
      `Scheme: ${tags.scheme_type}`,
      `Persona: ${tags.persona_target}`,
      tags.enforcement.legal_caveat || '',
    );
  }
  if (machinery.length) {
    appendix.push(
      `# Scheme of Inspection and Testing`,
      `## Associated testing machinery`,
      ...machinery.map(m => `- ${m}`),
      `## Factory log templates`,
      `Daily inspection and hydrostatic / safety test logs must be retained for audit.`,
    );
  }
  if (synonyms.length) {
    appendix.push(
      `# Layman search synonyms`,
      `## Colloquial terms`,
      synonyms.join(', '),
    );
  }
  if (appendix.length) {
    text = `${text}\n\n${appendix.join('\n')}`.trim();
  }

  return {
    ...draft,
    text,
    title,
    isNumbers,
    language,
    regulatory: tags,
    layman_synonyms: synonyms,
    related_standards: related,
    testing_machinery: machinery,
  };
}
