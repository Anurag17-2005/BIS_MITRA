import { stripClusterPrefix } from './clusters.js';

/** How a plan fetches. Every plan supports all three. */
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

/**
 * Per-plan demo copy: what is fetched, how (all vs search), from where (per method).
 */
export const PLAN_CATALOG = {
  ingest_bis_news: {
    brief: 'Fetches all news currently published on the BIS website.',
    what: 'All News & Announcements on the BIS portal',
    playwrightPattern: 'G',
    how: {
      api: 'All — full list, no search',
      db: 'All — every row in the news table',
      script: 'All — scrape the News page (no search box)',
    },
    from: {
      api: 'Clone REST GET /api/news (:4000)',
      db: 'SQLite table news (bis-clone.db)',
      script: 'BIS website http://localhost:3001/news · Playwright G',
    },
  },
  ingest_all_standards: {
    brief: 'Fetches the full standards catalog used on eBIS / Know Your Standards.',
    what: 'Standards catalog (IS number, title, status, mandatory/voluntary)',
    playwrightPattern: 'C',
    how: {
      api: 'All — full catalog, no search',
      db: 'All — every row in the standards table',
      script: 'All — scrape the Standards Under Certification table (optional filter query)',
    },
    from: {
      api: 'Clone REST GET /api/standards (:4000)',
      db: 'SQLite table standards (bis-clone.db)',
      script: 'eBIS http://localhost:3002/standards-under-certification · Playwright C',
    },
  },
  ingest_product_manuals: {
    brief: 'Fetches product manual PDFs listed on the BIS Product Manuals page.',
    what: 'Product manual PDFs (IS number, title, file)',
    playwrightPattern: 'D',
    how: {
      api: 'All — every manual in the database',
      db: 'All — every row in product_manuals',
      script: 'Search — types a keyword on Product Manuals, then downloads matching PDFs (default query 3055)',
    },
    from: {
      api: 'Clone REST GET /api/product-manuals (:4000) + files under /files',
      db: 'SQLite table product_manuals + public/files PDFs',
      script: 'BIS website http://localhost:3001/product-manuals · Playwright D',
    },
  },
  ingest_marking_fees: {
    brief: 'Fetches marking-fee amounts for certified products.',
    what: 'Marking fee table (IS number, title, annual fee)',
    playwrightPattern: 'E',
    how: {
      api: 'All — full fee table, no search',
      db: 'All — every row in marking_fees',
      script: 'Search — login to eBIS, then search Marking Fee (default query helmet)',
    },
    from: {
      api: 'Clone REST GET /api/marking-fees (:4000)',
      db: 'SQLite table marking_fees (bis-clone.db)',
      script: 'eBIS http://localhost:3002/marking-fee (after login) · Playwright E',
    },
  },
  ingest_process_pdfs: {
    brief: 'Fetches certification process guideline PDFs from the BIS process directory.',
    what: 'Certification process PDFs (Scheme-I guidelines and related)',
    playwrightPattern: 'B',
    how: {
      api: 'All — every process document, no search',
      db: 'All — every row in process_documents',
      script: 'All — directory of direct PDF links (no search)',
    },
    from: {
      api: 'Clone REST GET /api/process-documents (:4000)',
      db: 'SQLite table process_documents + public/files PDFs',
      script: 'BIS website http://localhost:3001/product-certification/process · Playwright B',
    },
  },
  ingest_schemes_docs: {
    brief: 'Fetches Scheme-I / QCO gazette PDFs from the BIS document library.',
    what: 'QCO notifications, scheme guidelines, compulsory product lists',
    playwrightPattern: null,
    how: {
      api: 'All — /api/documents?domain=schemes',
      db: 'All — portal_documents where domain=schemes',
      script: 'Same as API (no dedicated scrape pattern)',
    },
    from: {
      api: 'Clone REST GET /api/documents?domain=schemes',
      db: 'SQLite table portal_documents',
      script: 'Clone REST GET /api/documents?domain=schemes',
    },
  },
  ingest_hallmarking_docs: {
    brief: 'Fetches hallmarking guidelines and AHC PDFs.',
    what: 'Hallmarking orders, jeweller registration, AHC manuals',
    playwrightPattern: null,
    how: {
      api: 'All — /api/documents?domain=hallmarking',
      db: 'All — portal_documents where domain=hallmarking',
      script: 'Same as API',
    },
    from: {
      api: 'Clone REST GET /api/documents?domain=hallmarking',
      db: 'SQLite table portal_documents',
      script: 'Clone REST GET /api/documents?domain=hallmarking',
    },
  },
  ingest_labs_docs: {
    brief: 'Fetches laboratory recognition scheme documents.',
    what: 'Group-1 / Group-2 lab lists, LRS fees and forms',
    playwrightPattern: null,
    how: {
      api: 'All — /api/documents?domain=labs',
      db: 'All — portal_documents where domain=labs',
      script: 'Same as API',
    },
    from: {
      api: 'Clone REST GET /api/documents?domain=labs',
      db: 'SQLite table portal_documents',
      script: 'Clone REST GET /api/documents?domain=labs',
    },
  },
  ingest_consumer_docs: {
    brief: 'Fetches consumer complaint and awareness PDFs.',
    what: 'Complaint procedures, ISI verification, consumer rights',
    playwrightPattern: null,
    how: {
      api: 'All — /api/documents?domain=consumer',
      db: 'All — portal_documents where domain=consumer',
      script: 'Same as API',
    },
    from: {
      api: 'Clone REST GET /api/documents?domain=consumer',
      db: 'SQLite table portal_documents',
      script: 'Clone REST GET /api/documents?domain=consumer',
    },
  },
  ingest_demo_standards: {
    brief: 'Structured demo standards records (IS DEMO series) from Clone SQLite via API.',
    what: 'One warehouse JSON per demo standard (demo_id, scope, QCO refs)',
    playwrightPattern: null,
    how: { api: 'All demo standards', db: 'standards WHERE demo_id IS NOT NULL', script: 'N/A' },
    from: { api: 'GET /api/demo/standards', db: 'SQLite standards', script: '—' },
  },
  ingest_demo_qco: {
    brief: 'Structured QCO / gazette demo orders.',
    what: 'One warehouse JSON per QCO demo record',
    playwrightPattern: null,
    how: { api: 'All QCO rows with demo_id', db: 'qco_orders WHERE demo_id IS NOT NULL', script: 'N/A' },
    from: { api: 'GET /api/qco', db: 'SQLite qco_orders', script: '—' },
  },
  ingest_demo_certification: {
    brief: 'Demo CML / licensed manufacturer registry.',
    what: 'One warehouse JSON per certification demo record',
    playwrightPattern: null,
    how: { api: 'All demo CML rows', db: 'mock_licensed_manufacturers', script: 'N/A' },
    from: { api: 'GET /api/certification-registry', db: 'SQLite mock_licensed_manufacturers', script: '—' },
  },
  ingest_demo_laboratories: {
    brief: 'Demo NABL lab capability records.',
    what: 'One warehouse JSON per lab demo record',
    playwrightPattern: null,
    how: { api: 'Labs with demo_id', db: 'labs WHERE demo_id IS NOT NULL', script: 'N/A' },
    from: { api: 'GET /api/labs', db: 'SQLite labs', script: '—' },
  },
  ingest_demo_hallmarking_huid: {
    brief: 'Demo HUID hallmarking ledger entries.',
    what: 'One warehouse JSON per HUID demo record',
    playwrightPattern: null,
    how: { api: 'All demo HUID rows', db: 'mock_huid_ledger', script: 'N/A' },
    from: { api: 'GET /api/huid-ledger', db: 'SQLite mock_huid_ledger', script: '—' },
  },
  ingest_demo_consumer_complaints: {
    brief: 'Demo consumer complaint tickets.',
    what: 'One warehouse JSON per complaint demo record',
    playwrightPattern: null,
    how: { api: 'Grievances with demo_id', db: 'mock_grievances', script: 'N/A' },
    from: { api: 'GET /api/consumer/grievances', db: 'SQLite mock_grievances', script: '—' },
  },
  ingest_demo_enforcement: {
    brief: 'Demo enforcement / factory inspection cases.',
    what: 'One warehouse JSON per enforcement case',
    playwrightPattern: null,
    how: { api: 'All enforcement cases', db: 'enforcement_cases', script: 'N/A' },
    from: { api: 'GET /api/enforcement/cases', db: 'SQLite enforcement_cases', script: '—' },
  },
  ingest_demo_surveillance: {
    brief: 'Demo market / factory surveillance cases.',
    what: 'One warehouse JSON per surveillance case',
    playwrightPattern: null,
    how: { api: 'All surveillance cases', db: 'surveillance_cases', script: 'N/A' },
    from: { api: 'GET /api/surveillance', db: 'SQLite surveillance_cases', script: '—' },
  },
  probe_kys_search: {
    brief: 'Probes Know Your Standards search — result only, not stored in the warehouse.',
    what: 'Search hits for a product name or IS number',
    playwrightPattern: 'A',
    how: {
      api: 'Search — uses the plan query chips (e.g. cycle, helmet)',
      db: 'Search — LIKE filter on standards.title / is_number',
      script: 'Search — types the query in Know Your Standards search box',
    },
    from: {
      api: 'Clone REST GET /api/standards?q= (:4000)',
      db: 'SQLite table standards (filtered)',
      script: 'Standards portal http://localhost:3003/know-your-standards · Playwright A',
    },
  },
  probe_marking_fee: {
    brief: 'Probes marking-fee lookup for a keyword — result only, not stored.',
    what: 'Matching marking-fee rows for a product keyword',
    playwrightPattern: 'E',
    how: {
      api: 'Search — uses the plan query chips (e.g. helmet)',
      db: 'Search — LIKE filter on marking_fees.keywords / title',
      script: 'Search — login to eBIS, then search Marking Fee',
    },
    from: {
      api: 'Clone REST GET /api/marking-fees?q= (:4000)',
      db: 'SQLite table marking_fees (filtered)',
      script: 'eBIS http://localhost:3002/marking-fee · Playwright E',
    },
  },
  probe_fetch_orgdata: {
    brief: 'Probes org / licence demo data (applications on file). Not stored in the warehouse.',
    what: 'Org licence snapshot and submitted applications',
    playwrightPattern: 'N',
    how: {
      api: 'Lookup — uses probe queries (org id / IS number)',
      db: 'Lookup — applications + licences filtered by org or keyword',
      script: 'Session — login to eBIS and scrape the dashboard (org-gated UI)',
    },
    from: {
      api: 'Clone REST GET /api/licences + /api/applications (:4000)',
      db: 'SQLite tables licences, applications (bis-clone.db)',
      script: 'eBIS http://localhost:3002/login → dashboard · Playwright N',
    },
  },
  probe_standard_detail: {
    brief: 'Probes full standard detail page — metadata, referred standards, manual, fee. Not stored.',
    what: 'IS standard detail with referred standards and linked documents',
    playwrightPattern: 'F',
    how: {
      api: 'Lookup — IS number query (e.g. IS 623:2025)',
      db: 'Join standards + referred_standards + manuals + fees',
      script: 'Navigate standard detail page · Playwright F',
    },
    from: {
      api: 'Clone REST GET /api/standards/:is/detail (:4000)',
      db: 'SQLite standards + referred_standards + product_manuals + marking_fees',
      script: 'Standards portal http://localhost:3003/standard-details/:is · Playwright F',
    },
  },
  probe_compulsory_search: {
    brief: 'Probes mandatory certification product list. Not stored.',
    what: 'Compulsory BIS certification products (Scheme-I)',
    playwrightPattern: 'C',
    how: {
      api: 'Search — keyword or IS number',
      db: 'Filter standards WHERE mandatory_voluntary = Mandatory',
      script: 'Scrape compulsory certification table · Playwright C',
    },
    from: {
      api: 'Clone REST GET /api/compulsory-products?q= (:4000)',
      db: 'SQLite standards (mandatory only)',
      script: 'BIS http://localhost:3001/product-certification/compulsory · Playwright C',
    },
  },
  probe_certification_search: {
    brief: 'Probes standards-under-certification table. Not stored.',
    what: 'Certification list with mandatory/voluntary flag',
    playwrightPattern: 'C',
    how: {
      api: 'Search — optional filter keyword',
      db: 'Standards table as certification rows',
      script: 'eBIS standards-under-certification · Playwright C',
    },
    from: {
      api: 'Clone REST GET /api/certification-list?q= (:4000)',
      db: 'SQLite standards',
      script: 'eBIS http://localhost:3002/standards-under-certification · Playwright C',
    },
  },
  probe_manual_search: {
    brief: 'Probes product manual search. Not stored.',
    what: 'Product manual PDF metadata',
    playwrightPattern: 'D',
    how: {
      api: 'Search — IS number or keyword',
      db: 'LIKE filter on product_manuals',
      script: 'Product manuals search · Playwright D',
    },
    from: {
      api: 'Clone REST GET /api/product-manuals?q= (:4000)',
      db: 'SQLite product_manuals',
      script: 'BIS http://localhost:3001/product-manuals · Playwright D',
    },
  },
  probe_news_search: {
    brief: 'Probes BIS news by keyword. Not stored.',
    what: 'News and announcements matching keyword',
    playwrightPattern: 'G',
    how: {
      api: 'Search — title/summary/category keyword',
      db: 'LIKE filter on news table',
      script: 'Scrape news page (all items) · Playwright G',
    },
    from: {
      api: 'Clone REST GET /api/news?q= (:4000)',
      db: 'SQLite news',
      script: 'BIS http://localhost:3001/news · Playwright G',
    },
  },
  probe_application_search: {
    brief: 'Probes certification application status. Not stored.',
    what: 'Application reference, company, IS, status',
    playwrightPattern: null,
    how: {
      api: 'Lookup — reference ID, company, or IS number',
      db: 'Filter applications table',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/applications?q= (:4000)',
      db: 'SQLite applications',
      script: '—',
    },
  },
  probe_licence_search: {
    brief: 'Probes BIS licence records. Not stored.',
    what: 'Active/suspended licences by org or IS',
    playwrightPattern: null,
    how: {
      api: 'Lookup — org ID, company, or IS number',
      db: 'Filter licences table',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/licences?q= (:4000)',
      db: 'SQLite licences',
      script: '—',
    },
  },
  probe_hallmarking_search: {
    brief: 'Probes hallmarking centre directory. Not stored.',
    what: 'AHC and offsite centres by city/state/district',
    playwrightPattern: null,
    how: {
      api: 'Search — city, state, district, or centre name',
      db: 'LIKE filter on hallmarking_centres',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/hallmarking-centres?q= (:4000)',
      db: 'SQLite hallmarking_centres',
      script: '—',
    },
  },
  probe_labs_search: {
    brief: 'Probes recognised and empanelled testing labs. Not stored.',
    what: 'Group-1 recognised and Group-2 empanelled labs',
    playwrightPattern: null,
    how: {
      api: 'Search — city, scope, or product type',
      db: 'LIKE filter on labs table',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/labs?q= (:4000)',
      db: 'SQLite labs',
      script: '—',
    },
  },
  probe_consumer_search: {
    brief: 'Probes consumer guidance topics. Not stored.',
    what: 'Complaints, hallmarking, mark verification, consumer rights',
    playwrightPattern: null,
    how: {
      api: 'Search — topic keyword',
      db: 'LIKE filter on consumer_topics',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/consumer?q= (:4000)',
      db: 'SQLite consumer_topics',
      script: '—',
    },
  },
  probe_qco_search: {
    brief: 'Probes Quality Control Orders and scheme notifications. Not stored.',
    what: 'QCO gazette orders by product, sector, scheme (ISI/CRS)',
    playwrightPattern: null,
    how: {
      api: 'Search — product, sector, IS, or scheme keyword',
      db: 'LIKE filter on qco_orders',
      script: 'Not available — API/DB only',
    },
    from: {
      api: 'Clone REST GET /api/qco?q= (:4000)',
      db: 'SQLite qco_orders',
      script: '—',
    },
  },
};

export const PLAYWRIGHT_BY_BASE = Object.fromEntries(
  Object.entries(PLAN_CATALOG).map(([k, v]) => [k, v.playwrightPattern])
);

export function planBaseId(planId, clusterId) {
  return stripClusterPrefix(planId, clusterId);
}

export function catalogFor(plan) {
  return PLAN_CATALOG[planBaseId(plan.id, plan.clusterId)] || PLAN_CATALOG[planBaseId(plan.baseId, plan.clusterId)] || null;
}

export function methodById(id) {
  return FETCH_METHODS.find(m => m.id === id) || null;
}

export const METHODS = FETCH_METHODS;

export function methodsForKind() {
  return FETCH_METHODS;
}

export function methodLabel(method) {
  const id = normalizeFetchMethod(method);
  return methodById(id)?.label || 'Clone API';
}

export function normalizeFetchMethod(value) {
  if (value === 'db') return 'db';
  if (value === 'script' || value === 'playwright' || (typeof value === 'string' && /playwright|script/i.test(value))) {
    return 'script';
  }
  return 'api';
}

export function applyMethodToPlan(plan, methodId) {
  const id = normalizeFetchMethod(methodId);
  if (!methodById(id)) throw new Error(`Unknown method: ${methodId}`);
  const cat = catalogFor(plan);
  plan.method = id;
  if (cat?.playwrightPattern) plan.playwrightPattern = cat.playwrightPattern;
  return plan;
}

export function decoratePlan(plan) {
  const method = normalizeFetchMethod(plan.method);
  const cat = catalogFor(plan);
  if (!cat) return { ...plan, method };
  return {
    ...plan,
    method,
    playwrightPattern: cat.playwrightPattern,
    brief: cat.brief,
    what: cat.what,
    how: cat.how[method],
    from: cat.from[method],
    howByMethod: cat.how,
    fromByMethod: cat.from,
  };
}
