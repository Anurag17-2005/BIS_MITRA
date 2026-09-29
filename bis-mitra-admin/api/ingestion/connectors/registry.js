import { openCloneDb } from '../../clone-db.js';
import {
  DEMO_INGEST_CONNECTORS,
  isDemoIngestConnector,
  getDemoConnector,
  buildDemoApiPayload,
  buildDemoDbPayload,
  warehouseItemsFromDemoIngest,
} from './demo-ingest.js';

const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

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

/**
 * Fetch demo connector via Clone REST API.
 */
export async function fetchDemoConnectorApi(connectorId, conditional = {}) {
  const def = getDemoConnector(connectorId);
  if (!def) throw new Error(`Unknown demo connector: ${connectorId}`);

  const meta = await fetchJson(`${CLONE_API}${def.apiPath}`, conditional);
  if (meta.notModified) {
    return {
      payload: {
        via: 'api',
        dataset: def.dataset,
        count: 0,
        records: [],
        notModified: true,
      },
      httpMeta: meta,
    };
  }

  return {
    payload: buildDemoApiPayload(def, meta.data, 'api'),
    httpMeta: meta,
  };
}

/**
 * Fetch demo connector via direct SQLite read.
 */
export function fetchDemoConnectorDb(connectorId) {
  const def = getDemoConnector(connectorId);
  if (!def) throw new Error(`Unknown demo connector: ${connectorId}`);

  const db = openCloneDb();
  try {
    const rows = db.prepare(def.dbSql).all();
    return { payload: buildDemoDbPayload(def, rows) };
  } finally {
    db.close();
  }
}

export {
  isDemoIngestConnector,
  getDemoConnector,
  warehouseItemsFromDemoIngest,
  DEMO_INGEST_CONNECTORS,
};
