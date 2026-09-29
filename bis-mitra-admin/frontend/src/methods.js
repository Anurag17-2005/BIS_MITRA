/** Mirrors api/methods.js labels for the picker. Plan hover copy comes from the API (decoratePlan). */
export const FETCH_METHODS = [
  {
    id: 'api',
    label: 'Clone API',
    description: 'HTTP GET against Clone B REST on :4000 (same JSON the portals use).',
  },
  {
    id: 'db',
    label: 'Direct DB',
    description: 'Read Clone B SQLite (bis-clone.db) directly — no HTTP hop.',
  },
  {
    id: 'script',
    label: 'Playwright script',
    description: 'Drive the Clone B browser UI: scrape text and/or download PDFs.',
  },
];

export function methodOptionsForPlan() {
  return FETCH_METHODS;
}

export function methodLabel(method) {
  if (method === 'upload' || method === 'Manual upload') return 'Manual upload';
  const hit = FETCH_METHODS.find(m => m.id === method || m.label === method);
  if (hit) return hit.label;
  if (method === 'playwright' || (typeof method === 'string' && /playwright|script/i.test(method))) {
    return 'Playwright script';
  }
  if (method === 'db') return 'Direct DB';
  return 'Clone API';
}
