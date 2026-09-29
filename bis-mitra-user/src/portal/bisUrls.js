/** BIS clone frontends — override in .env when Vite picks another port. */
export const BIS_WEB = import.meta.env.VITE_BIS_URL || 'http://localhost:3001';
export const BIS_API = import.meta.env.VITE_BIS_API || 'http://localhost:4000';
export const MANAK_WEB = import.meta.env.VITE_MANAK_URL || 'http://localhost:3002';

export const BIS_LIBRARY = `${BIS_WEB}/library`;
export const MANAK_APPLICATIONS_URL = `${MANAK_WEB}/applications`;

/** Keep aligned with api/retrieval/score-policy.js */
export const SOURCE_MIN_SCORE = Number(import.meta.env.VITE_SOURCE_MIN_SCORE) || 0.05;
export const SOURCE_RELATIVE_FLOOR = Number(import.meta.env.VITE_SOURCE_RELATIVE_FLOOR) || 0.65;
export const SOURCE_MAX = Number(import.meta.env.VITE_SOURCE_MAX) || 5;

export { openOnBisUrl, resolvePortalUrl } from './portalProvenance';

let LIB = null;

const norm = (p = '') => {
  let s = String(p);
  try { s = decodeURIComponent(s); } catch { /* ignore */ }
  return s.toLowerCase().replace(/^\/+/, '').replace(/^.*?(knowledge\/)/, '$1');
};

/** Domain lookup for display labels only (Open on BIS uses portal pages). */
export async function loadLibraryIndex() {
  if (LIB) return LIB;
  try {
    const rows = await (await fetch(`${BIS_API}/api/documents`)).json();
    const m = new Map();
    (rows || []).forEach((d) => {
      if (d.pdf_path) m.set(norm(d.pdf_path), d.domain);
      if (d.filename) m.set(String(d.filename).toLowerCase(), d.domain);
    });
    LIB = m;
  } catch {
    LIB = new Map();
  }
  return LIB;
}

export function librarySectionFromSource(source = {}) {
  const key = norm(source.storage_uri || source.source_file || '');
  const hit = LIB?.get(key) || LIB?.get(key.split('/').pop());
  if (hit) return hit;
  if (/\/pdfs\/demo\//.test(key)) return 'process';
  if (/\/pdfs\/hallmarking\//.test(key)) return 'hallmarking';
  if (/\/pdfs\/labs\//.test(key)) return 'labs';
  if (/\/pdfs\/consumer\//.test(key)) return 'consumer';
  if (/\/pdfs\/schemes\//.test(key)) return 'schemes';
  if (/\/pdfs\/manuals\//.test(key)) return 'manuals';
  if (/\/pdfs\/standards-meta\//.test(key)) return 'standards';
  return 'process';
}

export const LIBRARY_SECTION_LABELS = {
  process: 'Certification process',
  schemes: 'Schemes & QCOs',
  fees: 'Marking fees',
  manuals: 'Product manuals',
  standards: 'Standards documents',
  hallmarking: 'Hallmarking',
  labs: 'Labs & LRS',
  consumer: 'Consumer affairs',
  news: 'News',
};
