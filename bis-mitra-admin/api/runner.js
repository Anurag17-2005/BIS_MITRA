import path from 'path';
import { warehouseViewUrl } from './fileUrls.js';
import { normalizeFetchMethod } from './methods.js';
import { runPlaywrightPattern } from './playwright-runner.js';
import { openCloneDb } from './clone-db.js';
import { assertApiReady, assertScriptReady } from './preflight.js';
import { executeProbeApi } from './core/probes.js';
import { CONNECTOR_SECTION } from './sections.js';
import {
  isDemoIngestConnector,
  fetchDemoConnectorApi,
  fetchDemoConnectorDb,
  warehouseItemsFromDemoIngest,
} from './connectors/registry.js';

const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

const PROBE_CONNECTORS = new Set([
  'standards_search', 'standard_detail', 'fees_search', 'compulsory_search',
  'certification_search', 'manuals_search', 'news_search', 'application_search',
  'licence_search', 'fetch_orgdata', 'hallmarking_search', 'labs_search',
  'consumer_search', 'qco_search',
]);

async function fetchJson(url, { etag = null, lastModified = null } = {}) {
  const headers = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;
  const res = await fetch(url, { headers });
  if (res.status === 304) {
    return {
      notModified: true,
      etag: res.headers.get('etag') || etag,
      lastModified: res.headers.get('last-modified') || lastModified,
      data: null,
    };
  }
  if (!res.ok) throw new Error(`Clone API ${res.status} for ${url}`);
  const data = await res.json();
  return {
    notModified: false,
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
    data,
  };
}

function mapManualFiles(manuals) {
  return manuals
    .filter(m => m.pdf_path)
    .map(m => ({
      name: path.basename(m.pdf_path),
      path: m.pdf_path,
      is_number: m.is_number,
      title: m.title,
      origin: 'clone',
    }));
}

function mapPortalFiles(docs) {
  return (docs || [])
    .filter(d => d.pdf_path || d.path)
    .map(d => ({
      name: d.filename || path.basename(d.pdf_path || d.path),
      path: d.pdf_path || d.path,
      title: d.title,
      scheme: d.domain || d.scheme,
      origin: 'clone',
    }));
}

function portalDocs(db, domain) {
  try {
    return db.prepare('SELECT * FROM portal_documents WHERE domain = ? ORDER BY id').all(domain);
  } catch {
    return [];
  }
}

async function executeViaApi(plan, queries) {
  await assertApiReady();
  const results = [];
  const connector = plan.connector || plan.id;
  const conditional = plan._conditionalHeaders || {};

  for (const q of queries) {
    try {
      let payload;
      let files = [];
      let httpMeta = null;

      if (isDemoIngestConnector(connector)) {
        const out = await fetchDemoConnectorApi(connector, conditional);
        httpMeta = out.httpMeta;
        payload = out.payload;
        results.push({
          query: q,
          success: true,
          payload,
          files,
          via: 'api',
          _http: httpMeta ? {
            etag: httpMeta.etag,
            lastModified: httpMeta.lastModified,
            notModified: !!httpMeta.notModified,
          } : null,
        });
        continue;
      }

      switch (connector) {
        case 'news_api': {
          const meta = await fetchJson(`${CLONE_API}/api/news`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { count: 0, items: [], via: 'api', notModified: true };
          } else {
            const items = meta.data;
            payload = { count: items.length, items, via: 'api' };
            try {
              const docsMeta = await fetchJson(`${CLONE_API}/api/documents?domain=news`);
              files = mapPortalFiles(docsMeta.data);
            } catch { /* optional news files */ }
          }
          break;
        }
        case 'standards_api': {
          const meta = await fetchJson(`${CLONE_API}/api/standards`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { via: 'api', count: 0, standards: [], notModified: true };
          } else {
            const data = meta.data;
            payload = {
              via: 'api',
              count: data.length,
              standards: data.map(s => ({
                is_number: s.is_number,
                title: s.title,
                status: s.status,
                mandatory_voluntary: s.mandatory_voluntary,
              })),
            };
            try {
              const docsMeta = await fetchJson(`${CLONE_API}/api/documents?domain=standards`);
              files = mapPortalFiles(docsMeta.data);
            } catch { /* optional extra PDFs */ }
          }
          break;
        }
        case 'manuals_api': {
          const meta = await fetchJson(`${CLONE_API}/api/product-manuals`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { via: 'api', count: 0, manuals: [], notModified: true };
          } else {
            const manuals = meta.data;
            payload = { via: 'api', count: manuals.length, manuals };
            files = mapManualFiles(manuals);
            try {
              const docsMeta = await fetchJson(`${CLONE_API}/api/documents?domain=manuals`);
              const extra = mapPortalFiles(docsMeta.data);
              const seen = new Set(files.map(f => f.name));
              for (const f of extra) {
                if (!seen.has(f.name)) files.push(f);
              }
            } catch { /* extra manuals from knowledge pack */ }
          }
          break;
        }
        case 'fees_api': {
          const meta = await fetchJson(`${CLONE_API}/api/marking-fees`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { via: 'api', fees: [], notModified: true };
          } else {
            payload = { via: 'api', fees: meta.data };
            try {
              const docsMeta = await fetchJson(`${CLONE_API}/api/documents?domain=fees`);
              files = mapPortalFiles(docsMeta.data);
            } catch { /* optional fee PDFs */ }
          }
          break;
        }
        case 'process_api': {
          const meta = await fetchJson(`${CLONE_API}/api/documents?domain=process`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { via: 'api', count: 0, documents: [], notModified: true };
          } else {
            const docs = meta.data;
            payload = { via: 'api', count: docs.length, documents: docs };
            files = mapPortalFiles(docs);
          }
          break;
        }
        case 'schemes_api':
        case 'hallmarking_api':
        case 'labs_docs_api':
        case 'consumer_docs_api': {
          const domain = CONNECTOR_SECTION[connector];
          const meta = await fetchJson(`${CLONE_API}/api/documents?domain=${domain}`, conditional);
          httpMeta = meta;
          if (meta.notModified) {
            payload = { via: 'api', count: 0, documents: [], notModified: true };
          } else {
            const docs = meta.data;
            payload = { via: 'api', count: docs.length, documents: docs };
            files = mapPortalFiles(docs);
          }
          break;
        }
        default: {
          if (PROBE_CONNECTORS.has(connector)) {
            payload = { via: 'api', ...(await executeProbeApi(connector, q)) };
          } else {
            payload = { via: 'api', message: `No connector for ${connector}` };
          }
          break;
        }
      }

      if (httpMeta?.etag || httpMeta?.lastModified) {
        payload._http = {
          etag: httpMeta.etag,
          lastModified: httpMeta.lastModified,
          notModified: !!httpMeta.notModified,
        };
      }

      results.push({ query: q, success: true, payload, files, via: 'api' });
    } catch (err) {
      results.push({ query: q, success: false, error: err.message, via: 'api' });
    }
  }

  return { success: results.every(r => r.success), via: 'api', results };
}

function executeViaDb(plan, queries) {
  const db = openCloneDb();
  const results = [];
  const connector = plan.connector || plan.id;
  try {
    for (const q of queries) {
      try {
        let payload;
        let files = [];

        if (isDemoIngestConnector(connector)) {
          payload = fetchDemoConnectorDb(connector).payload;
          results.push({ query: q, success: true, payload, files, via: 'db' });
          continue;
        }

        switch (connector) {
          case 'news_api': {
            const items = db.prepare('SELECT * FROM news ORDER BY published_at DESC, id DESC').all();
            payload = { count: items.length, items, via: 'db' };
            files = mapPortalFiles(portalDocs(db, 'news'));
            break;
          }
          case 'standards_api': {
            const data = db.prepare('SELECT * FROM standards ORDER BY is_number').all();
            payload = {
              via: 'db',
              count: data.length,
              standards: data.map(s => ({
                is_number: s.is_number,
                title: s.title,
                status: s.status,
                mandatory_voluntary: s.mandatory_voluntary,
              })),
            };
            files = mapPortalFiles(portalDocs(db, 'standards'));
            break;
          }
          case 'manuals_api': {
            const manuals = db.prepare('SELECT * FROM product_manuals ORDER BY sr_no').all();
            payload = { via: 'db', count: manuals.length, manuals };
            files = mapManualFiles(manuals);
            const extra = mapPortalFiles(portalDocs(db, 'manuals'));
            const seen = new Set(files.map(f => f.name));
            for (const f of extra) {
              if (!seen.has(f.name)) files.push(f);
            }
            break;
          }
          case 'fees_api': {
            const fees = db.prepare('SELECT * FROM marking_fees ORDER BY is_number').all();
            payload = { via: 'db', fees };
            files = mapPortalFiles(portalDocs(db, 'fees'));
            break;
          }
          case 'process_api':
          case 'schemes_api':
          case 'hallmarking_api':
          case 'labs_docs_api':
          case 'consumer_docs_api': {
            const domain = CONNECTOR_SECTION[connector];
            const docs = portalDocs(db, domain);
            payload = { via: 'db', count: docs.length, documents: docs };
            files = mapPortalFiles(docs);
            break;
          }
          case 'standards_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM standards WHERE is_number LIKE ? OR title LIKE ? OR description LIKE ? LIMIT 20`
            ).all(like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'standard_detail': {
            const isNumber = q || 'IS 623:2025';
            const standard = db.prepare('SELECT * FROM standards WHERE is_number = ?').get(isNumber);
            const referred = db.prepare('SELECT * FROM referred_standards WHERE parent_is = ?').all(isNumber);
            const manual = db.prepare('SELECT * FROM product_manuals WHERE is_number = ?').get(isNumber);
            const fee = db.prepare('SELECT * FROM marking_fees WHERE is_number = ?').get(isNumber);
            payload = { via: 'db', query: isNumber, standard, referred_standards: referred, product_manual: manual, marking_fee: fee };
            break;
          }
          case 'fees_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM marking_fees WHERE keywords LIKE ? OR title LIKE ? OR is_number LIKE ?`
            ).all(like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'compulsory_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT is_number, title, mandatory_voluntary FROM standards WHERE mandatory_voluntary = 'Mandatory'
               AND (is_number LIKE ? OR title LIKE ? OR description LIKE ?) LIMIT 20`
            ).all(like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'certification_search': {
            const like = `%${q || ''}%`;
            const sql = q
              ? `SELECT is_number as standard_number, title as standard_title, mandatory_voluntary FROM standards WHERE is_number LIKE ? OR title LIKE ? LIMIT 20`
              : `SELECT is_number as standard_number, title as standard_title, mandatory_voluntary FROM standards ORDER BY is_number`;
            const data = q ? db.prepare(sql).all(like, like) : db.prepare(sql).all();
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'manuals_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM product_manuals WHERE is_number LIKE ? OR title LIKE ? ORDER BY sr_no`
            ).all(like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'news_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM news WHERE title LIKE ? OR summary LIKE ? OR category LIKE ? ORDER BY published_at DESC LIMIT 20`
            ).all(like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'application_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM applications WHERE reference_id LIKE ? OR company_name LIKE ? OR is_number LIKE ? OR product_name LIKE ? ORDER BY submitted_at DESC LIMIT 20`
            ).all(like, like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'licence_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM licences WHERE licence_number LIKE ? OR org_id LIKE ? OR company_name LIKE ? OR is_number LIKE ? LIMIT 20`
            ).all(like, like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'fetch_orgdata': {
            const orgId = String(q).includes('DEMO') ? q : 'DEMO_MSME';
            const licences = db.prepare('SELECT * FROM licences WHERE org_id = ?').all(orgId);
            const like = `%${q || ''}%`;
            const apps = db.prepare(
              `SELECT * FROM applications WHERE company_name LIKE ? OR is_number LIKE ? OR reference_id LIKE ?`
            ).all(like, like, like);
            payload = {
              via: 'db',
              query: q,
              org: orgId,
              licence_status: licences[0]?.status || 'active',
              licences,
              applications: apps.length,
              records: apps,
              note: 'Probe only — not stored in global warehouse.',
            };
            break;
          }
          case 'hallmarking_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM hallmarking_centres WHERE name LIKE ? OR city LIKE ? OR district LIKE ? OR state LIKE ? LIMIT 20`
            ).all(like, like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'labs_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM labs WHERE name LIKE ? OR city LIKE ? OR scope LIKE ? OR lab_code LIKE ? LIMIT 20`
            ).all(like, like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'consumer_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM consumer_topics WHERE title LIKE ? OR summary LIKE ? OR keywords LIKE ? LIMIT 20`
            ).all(like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          case 'qco_search': {
            const like = `%${q || ''}%`;
            const data = db.prepare(
              `SELECT * FROM qco_orders WHERE product LIKE ? OR is_number LIKE ? OR keywords LIKE ? OR sector LIKE ? LIMIT 20`
            ).all(like, like, like, like);
            payload = { via: 'db', query: q, resultCount: data.length, results: data };
            break;
          }
          default:
            payload = { via: 'db', message: `No connector for ${connector}` };
        }
        results.push({ query: q, success: true, payload, files, via: 'db' });
      } catch (err) {
        results.push({ query: q, success: false, error: err.message, via: 'db' });
      }
    }
  } finally {
    db.close();
  }
  return { success: results.every(r => r.success), via: 'db', results };
}

function scriptPayload(out, connector) {
  const scraped = out.payload?.scraped || {};
  if (connector === 'news_api') {
    const items = scraped.items || scraped.news || [];
    return { via: 'script', count: items.length, items, source_url: out.payload.source_url };
  }
  if (connector === 'standards_api') {
    const rows = scraped.rows || [];
    return {
      via: 'script',
      count: rows.length,
      standards: rows.map(r => ({
        is_number: r.is_number || r.standard_number,
        title: r.title || r.standard_title,
      })),
      source_url: out.payload.source_url,
    };
  }
  if (connector === 'fees_api' || connector === 'fees_search') {
    return {
      via: 'script',
      query: scraped.query,
      fees: scraped.results || [],
      fee_amount: scraped.fee_amount,
      source_url: out.payload.source_url,
    };
  }
  if (connector === 'standards_search') {
    const results = scraped.results || [];
    return {
      via: 'script',
      query: scraped.query,
      resultCount: results.length,
      results,
      source_url: out.payload.source_url,
    };
  }
  if (connector === 'fetch_orgdata') {
    return { via: 'script', ...scraped, source_url: out.payload.source_url, note: 'Probe only.' };
  }
  return out.payload;
}

async function executeViaScript(plan, queries) {
  const pattern = plan.playwrightPattern;
  if (!pattern) throw new Error(`${plan.name} has no Playwright pattern configured`);
  await assertScriptReady(pattern);

  const results = [];
  const toRun = queries.length ? queries : [''];
  const list = plan.kind === 'ingest' ? [toRun[0] || ''] : toRun;

  for (const q of list) {
    try {
      const out = await runPlaywrightPattern(pattern, q);
      results.push({
        query: q,
        success: true,
        payload: scriptPayload(out, plan.connector),
        files: out.files,
        via: 'script',
        pattern: out.pattern,
      });
    } catch (err) {
      results.push({ query: q, success: false, error: err.message, via: 'script' });
    }
  }

  return { success: results.every(r => r.success), via: 'script', results };
}

export async function executePlan(plan, selectedQueries = []) {
  const queries = selectedQueries.length
    ? selectedQueries
    : (plan.queries?.length ? plan.queries : ['']);
  const method = normalizeFetchMethod(plan.method);

  if (method === 'script') return executeViaScript(plan, queries);
  if (method === 'db') return executeViaDb(plan, queries);
  return executeViaApi(plan, queries);
}

function fileTypeFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (/\.(png|jpe?g)$/.test(lower)) return 'Image';
  if (lower.endsWith('.json')) return 'JSON';
  return 'PDF';
}

function pushPdfItems(items, base, sourceKey, domain, files) {
  for (const f of files) {
    const name = f.name || path.basename(f.path || f);
    const item = {
      ...base,
      id: `w-${sourceKey}-${name}`,
      name,
      domain,
      type: fileTypeFromName(name),
      filePath: f.path || f,
      fileSource: f.origin === 'playwright' || f.origin === 'script' ? 'fetched' : 'clone',
      meta: {
        is_number: f.is_number,
        title: f.title,
        scheme: f.scheme,
        via: f.origin || 'clone',
      },
    };
    item.viewUrl = warehouseViewUrl(item);
    items.push(item);
  }
}

export function warehouseItemsFromIngest(plan, runResult) {
  const now = new Date().toISOString();
  const sourceKey = plan.id;
  const connector = plan.connector;
  const items = [];
  const first = runResult.results?.[0];
  if (!first?.success) return items;

  const via = normalizeFetchMethod(plan.method);
  const base = {
    sourceKey,
    source: 'fetch',
    planId: plan.id,
    updatedAt: now,
    fetchMethod: via,
  };

  if (connector === 'news_api') {
    items.push({
      ...base,
      id: `w-${sourceKey}`,
      name: via === 'script' ? 'bis-news-script.json' : via === 'db' ? 'bis-news-db.json' : 'bis-news.json',
      domain: 'news',
      type: 'JSON',
      content: first.payload,
    });
    if (first.files?.length) pushPdfItems(items, base, sourceKey, 'news', first.files);
  }

  if (connector === 'standards_api') {
    items.push({
      ...base,
      id: `w-${sourceKey}`,
      name: via === 'script' ? 'standards-script.json' : 'standards-catalog.json',
      domain: 'standards',
      type: 'JSON',
      content: first.payload,
    });
    if (first.files?.length) pushPdfItems(items, base, sourceKey, 'standards', first.files);
  }

  if (connector === 'fees_api') {
    items.push({
      ...base,
      id: `w-${sourceKey}`,
      name: via === 'script' ? 'marking-fees-script.json' : 'marking-fees.json',
      domain: 'fees',
      type: 'JSON',
      content: first.payload?.fees ?? first.payload,
    });
    if (first.files?.length) pushPdfItems(items, base, sourceKey, 'fees', first.files);
  }

  if (connector === 'manuals_api') {
    const files = first.files || [];
    if (files.length === 0) {
      items.push({
        ...base,
        id: `w-${sourceKey}`,
        name: 'product-manuals.json',
        domain: 'manuals',
        type: 'JSON',
        content: first.payload,
      });
    } else {
      pushPdfItems(items, base, sourceKey, 'manuals', files);
    }
  }

  if (connector === 'process_api' || connector === 'schemes_api' || connector === 'hallmarking_api'
    || connector === 'labs_docs_api' || connector === 'consumer_docs_api') {
    const domain = CONNECTOR_SECTION[connector] || 'process';
    const files = first.files || [];
    if (files.length === 0) {
      items.push({
        ...base,
        id: `w-${sourceKey}`,
        name: `${domain}-docs.json`,
        domain,
        type: 'JSON',
        content: first.payload,
      });
    } else {
      pushPdfItems(items, base, sourceKey, domain, files);
    }
  }

  if (isDemoIngestConnector(connector)) {
    return warehouseItemsFromDemoIngest(plan, runResult);
  }

  return items;
}

export function warehouseFingerprint(items, domain) {
  const rows = (items || []).filter(i => i.domain === domain && i.source !== 'upload');
  if (domain === 'news') {
    const content = rows[0]?.content;
    const list = content?.items || (Array.isArray(content) ? content : []);
    return `${list.length}:${list.map(n => n.title || '').join(';')}`;
  }
  if (domain === 'standards') {
    const list = rows[0]?.content?.standards || [];
    return `${list.length}:${list.map(s => s.is_number || '').join(';')}`;
  }
  if (domain === 'fees') {
    const raw = rows[0]?.content;
    const list = Array.isArray(raw) ? raw : (raw?.fees || []);
    return `${list.length}:${list.map(f => f.is_number || f).join(';')}`;
  }
  return `${rows.length}:${rows.map(r => r.name).join(';')}`;
}
