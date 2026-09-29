import { expandQueryTerms, getSynonymOntology } from './regulatory/synonym-expander.js';
import { extractIdentifiers } from './identifiers.js';

/**
 * Derive display entities from query + expansion (no fabrication).
 */
export function extractQueryEntities(query) {
  const q = String(query || '').toLowerCase();
  const ontology = getSynonymOntology();
  const entities = [];

  for (const [layman, formalList] of Object.entries(ontology)) {
    if (q.includes(layman.toLowerCase())) {
      entities.push({ type: 'product', value: layman });
      continue;
    }
    for (const phrase of formalList) {
      if (q.includes(String(phrase).toLowerCase())) {
        entities.push({ type: 'product', value: phrase });
        break;
      }
    }
  }

  const ids = extractIdentifiers(query);
  for (const isn of ids.isNumbers) {
    entities.push({ type: 'is_number', value: isn });
  }
  for (const qco of ids.qcoIds) {
    entities.push({ type: 'qco', value: qco });
  }
  for (const cml of ids.cmlIds) {
    entities.push({ type: 'cml', value: cml });
  }
  for (const huid of ids.huidCodes) {
    entities.push({ type: 'huid', value: huid });
  }
  for (const lab of ids.labIds) {
    entities.push({ type: 'lab', value: lab });
  }
  for (const caseId of ids.caseIds) {
    entities.push({ type: 'case', value: caseId });
  }

  const expanded = expandQueryTerms(query);
  return { entities, expanded, identifiers: ids };
}
