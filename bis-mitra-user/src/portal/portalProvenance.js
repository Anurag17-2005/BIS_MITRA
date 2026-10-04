import { getBisWeb } from './portalUrls.js';

const FILE_PAGE = {
  'certification.pdf': '/product-certification/process',
  'consumer_complaints.pdf': '/consumer/complaints',
  'enforcement.pdf': '/regulatory-hub',
  'hallmarking.pdf': '/consumer-guidance',
  'laboratories.pdf': '/regulatory-hub',
  'qco.pdf': '/product-certification/process',
  'standards.pdf': '/regulatory-hub',
  'surveillance.pdf': '/regulatory-hub',
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
    || /bis-clone|vercel\.app/i.test(url)
    || url.includes('bis.gov.in')
    || isPortalPath(url);
}

export function resolvePortalUrl(source = {}) {
  if (source.portalUrl) return source.portalUrl;
  const sourceType = source.source_type || source.sourceType || null;

  if (sourceType === 'compulsory_portal') {
    return `${getBisWeb()}/product-certification/compulsory`;
  }

  const stored = source.sourceUrl || source.bisUrl || source.origin_url || null;
  if (stored && isPortalPath(stored)) return stored;
  if (stored && isBisHttp(stored)) return stored;

  if (sourceType && TYPE_PAGE[sourceType]) {
    return `${getBisWeb()}${TYPE_PAGE[sourceType]}`;
  }

  const file = basename(source.storage_uri || source.source_file);
  if (file && FILE_PAGE[file]) return `${getBisWeb()}${FILE_PAGE[file]}`;
  if (file && /_demo\.pdf$/.test(file)) return `${getBisWeb()}/product-certification/process`;

  const storage = String(source.storage_uri || source.source_file || '');
  if (/\/pdfs\/process\//i.test(storage)) return `${getBisWeb()}/product-certification/process`;
  if (/\/pdfs\/schemes\//i.test(storage)) return `${getBisWeb()}/product-certification/process`;
  if (/\/pdfs\/manuals\//i.test(storage)) return `${getBisWeb()}/product-manuals`;
  if (/\/pdfs\/consumer\//i.test(storage)) return `${getBisWeb()}/consumer/complaints`;
  if (/\/pdfs\/labs\//i.test(storage)) return `${getBisWeb()}/regulatory-hub`;
  if (/\/pdfs\/hallmarking\//i.test(storage)) return `${getBisWeb()}/consumer-guidance`;

  const domain = cleanDomain(source.librarySection || source.domain || source.section);
  if (domain && DOMAIN_PAGE[domain]) return `${getBisWeb()}${DOMAIN_PAGE[domain]}`;

  return null;
}

export function openOnBisUrl(source = {}) {
  const portal = resolvePortalUrl(source);
  if (portal) return portal;

  const direct = source.sourceUrl || source.bisUrl || source.source_reference;
  if (direct && /^https?:\/\//i.test(direct) && isPortalPath(direct)) return direct;
  if (direct && /^https?:\/\//i.test(direct) && direct.includes('bis.gov.in')) return direct;

  return null;
}
