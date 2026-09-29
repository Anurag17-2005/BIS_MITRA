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

/** Hindi → English domain glossary. The corpus is English, so Hindi queries need a literal translation. */
const HINDI_GLOSSARY = [
  [/हेलमेट/, 'helmet'], [/औद्योगिक/, 'industrial'], [/सुरक्षा/, 'safety'], [/मानक/, 'standard'],
  [/प्रमाणन|प्रमाणपत्र|सर्टिफिकेशन/, 'certification'], [/अनिवार्य|ज़रूरी|जरूरी/, 'mandatory'],
  [/स्वैच्छिक/, 'voluntary'], [/परीक्षण|टेस्ट/, 'test'], [/प्रयोगशाला|लैब/, 'laboratory'],
  [/दस्तावेज़|दस्तावेज|कागज़ात/, 'documents'], [/लाइसेंस/, 'licence'], [/कारखान|फैक्ट्री/, 'factory'],
  [/शिकायत/, 'complaint'], [/खिलौन/, 'toys'], [/सोन[ाे]|स्वर्ण/, 'gold'], [/आभूषण|गहन/, 'jewellery'],
  [/हॉलमार्क/, 'hallmark'], [/शुद्धता/, 'purity'], [/प्रेशर\s*कुकर/, 'pressure cooker'],
  [/गीज़र|गीजर/, 'geyser water heater'], [/साइकिल/, 'bicycle'], [/दोपहिया/, 'two-wheeler'],
  [/आवेदन/, 'application'], [/शुल्क|फीस/, 'fee'], [/निर्यात/, 'export'], [/आयात/, 'import'],
  [/गुणवत्ता\s*नियंत्रण\s*आदेश/, 'quality control order QCO'], [/उत्पाद/, 'product'],
];

export function translateHindiTerms(query = '') {
  const q = String(query);
  if (!/[\u0900-\u097f]/.test(q)) return [];
  return HINDI_GLOSSARY.filter(([re]) => re.test(q)).map(([, en]) => en);
}

/**
 * Expand a colloquial query into searchable tokens (formal + layman).
 */
export function expandQueryTerms(query = '') {
  const translatedTerms = translateHindiTerms(query);
  const q = `${query} ${translatedTerms.join(' ')}`.toLowerCase();
  const extras = new Set(translatedTerms);

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

  const expandedTerms = [...extras];
  return {
    original: query,
    expandedTerms,
    translatedTerms,
    /** Weighted boosts only. Do not replace the user query with this list. */
    boostTerms: expandedTerms.filter((t) => !translatedTerms.includes(t)),
    /** The user's query plus its literal translation — searched at full weight. */
    expandedQuery: translatedTerms.length ? `${query} ${translatedTerms.join(' ')}` : query,
  };
}

/**
 * Small additive boost when a hit overlaps synonym terms.
 * Capped so an expansion cannot outrank a direct lexical match on its own.
 */
export function synonymScoreBoost(blob, terms, { cap = 0.12, perTerm = 0.03 } = {}) {
  const hay = String(blob || '').toLowerCase();
  let hits = 0;
  for (const term of terms || []) {
    const t = String(term).toLowerCase().trim();
    if (t.length >= 3 && hay.includes(t)) hits += 1;
  }
  if (!hits) return 0;
  return Math.min(cap, perTerm * hits);
}

export function getSynonymOntology() {
  return ONTOLOGY;
}
