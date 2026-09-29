import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ONTOLOGY = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'synonyms.json'), 'utf8')
);

/**
 * Scan formal text; if technical phrases appear, inject colloquial index keys.
 */
export function enrichGoldenSynonyms(cleanTextBody = '') {
  const normalized = String(cleanTextBody).toLowerCase();
  const detected = new Set();

  for (const [layman, formalList] of Object.entries(ONTOLOGY)) {
    for (const phrase of formalList) {
      if (normalized.includes(String(phrase).toLowerCase())) {
        detected.add(layman);
        break;
      }
    }
    if (normalized.includes(layman.toLowerCase())) detected.add(layman);
  }

  return [...detected];
}

function isSpecificPhrase(phrase) {
  const p = String(phrase).toLowerCase();
  if (/^is\s*\d/i.test(p)) return true;
  if (p.length >= 16) return true;
  // Avoid expanding on generic fee/cost words alone
  if (/^(marking fee|licence fee|application fee|processing cost|water heater)$/.test(p)) {
    return false;
  }
  return p.split(/\s+/).length >= 3;
}

/**
 * Expand a colloquial query into searchable tokens (formal + layman).
 */
export function expandQueryTerms(query = '') {
  const q = String(query).toLowerCase();
  const extras = new Set();

  for (const [layman, formalList] of Object.entries(ONTOLOGY)) {
    if (q.includes(layman.toLowerCase())) {
      extras.add(layman);
      for (const phrase of formalList) extras.add(phrase);
    }
  }

  // Reverse: only for specific formal phrases (not generic "marking fee")
  for (const [layman, formalList] of Object.entries(ONTOLOGY)) {
    for (const phrase of formalList) {
      const p = String(phrase).toLowerCase();
      if (!isSpecificPhrase(p)) continue;
      if (q.includes(p)) {
        extras.add(layman);
        for (const x of formalList) extras.add(x);
      }
    }
  }

  return {
    original: query,
    expandedTerms: [...extras],
    expandedQuery: extras.size
      ? `${query} ${[...extras].join(' ')}`
      : query,
  };
}

export function getSynonymOntology() {
  return ONTOLOGY;
}
