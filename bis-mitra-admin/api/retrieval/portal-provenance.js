const BIS_WEB = process.env.BIS_WEB || process.env.VITE_BIS_URL || 'http://localhost:3001';

const FILE_PAGE = {
  'certification_demo.pdf': '/product-certification/process',
  'consumer_complaints_demo.pdf': '/consumer/complaints',
  'enforcement_demo.pdf': '/regulatory-hub',
  'hallmarking_demo.pdf': '/consumer-guidance',
  'laboratories_demo.pdf': '/regulatory-hub',
  'qco_demo.pdf': '/product-certification/process',
  'standards_demo.pdf': '/regulatory-hub',
  'surveillance_demo.pdf': '/regulatory-hub',
};

const DOMAIN_PAGE = {
  process: '/product-certification/process',
  consumer: '/consumer/complaints',
  hallmarking: '/consumer-guidance',
  labs: '/regulatory-hub',
  schemes: '/regulatory-hub',
  manuals: '/product-manuals',
  standards: '/regulatory-hub',
  fees: '/product-certification/process',
  news: '/news',
};

const TYPE_PAGE = {
  compulsory_portal: '/product-certification/compulsory',
  process_portal: '/product-certification/process',
  consumer_portal: '/consumer/complaints',
  bis_portal: '/regulatory-hub',
};

function basename(path = '') {
  return String(path).split('/').pop()?.toLowerCase() || '';
}

function cleanDomain(raw) {
  if (!raw) return null;
  return String(raw).replace(/^chunk:/i, '').trim() || null;
}

function isPortalPath(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('demo://') || url.startsWith('plan://')) return false;
  return url.includes('/product-certification/')
    || url.includes('/consumer/')
    || url.includes('/product-manuals')
    || url.includes('/regulatory-hub')
    || url.includes('/consumer-guidance')
    || url.includes('/news');
}

function isBisHttp(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return url.includes('localhost:3001')
    || url.includes('bis.gov.in')
    || isPortalPath(url);
}

/**
 * BIS clone page where the user originally sees this evidence (not /library).
 */
export function resolvePortalUrl(source = {}) {
  if (source.portalUrl) return source.portalUrl;
  const meta = source.metadata || {};
  const sourceType = source.source_type || source.sourceType || meta.source_type || null;

  if (sourceType === 'compulsory_portal' || source.dataset === 'compulsory_products') {
    return `${BIS_WEB}/product-certification/compulsory`;
  }

  // 1. Stored origin URL from ingestion / citation
  const stored = meta.source_url
    || source.sourceUrl
    || source.citation?.source_url
    || source.origin_url
    || null;
  if (stored && isPortalPath(stored)) return stored;
  if (stored && isBisHttp(stored)) return stored;

  // 2. Typed portal pages (set by stamp.js)
  if (sourceType && TYPE_PAGE[sourceType]) {
    return `${BIS_WEB}${TYPE_PAGE[sourceType]}`;
  }

  // 3. PDF filename → page map
  const file = basename(source.storage_uri || source.source_file || meta.source_file);
  if (file && FILE_PAGE[file]) return `${BIS_WEB}${FILE_PAGE[file]}`;
  if (file && /_demo\.pdf$/.test(file)) return `${BIS_WEB}/product-certification/process`;

  // 4. PDF folder path → page map
  const storage = String(source.storage_uri || source.source_file || meta.source_file || '');
  if (/\/pdfs\/process\//i.test(storage)) return `${BIS_WEB}/product-certification/process`;
  if (/\/pdfs\/schemes\//i.test(storage)) return `${BIS_WEB}/product-certification/process`;
  if (/\/pdfs\/manuals\//i.test(storage)) return `${BIS_WEB}/product-manuals`;
  if (/\/pdfs\/consumer\//i.test(storage)) return `${BIS_WEB}/consumer/complaints`;
  if (/\/pdfs\/labs\//i.test(storage)) return `${BIS_WEB}/regulatory-hub`;
  if (/\/pdfs\/hallmarking\//i.test(storage)) return `${BIS_WEB}/consumer-guidance`;

  // 5. Cleaned domain / section (never leave chunk: prefix)
  const domain = cleanDomain(
    source.domain || meta.domain || source.sectionTag || source.section || source.librarySection,
  );
  if (domain && DOMAIN_PAGE[domain]) return `${BIS_WEB}${DOMAIN_PAGE[domain]}`;

  if (source.retrievalMethod === 'qco_join') {
    return `${BIS_WEB}/product-certification/process`;
  }

  // demo:// references still map via domain/file above; otherwise hide button
  return null;
}

export { BIS_WEB, DOMAIN_PAGE, FILE_PAGE, cleanDomain };
