/**
 * Demo structured dataset connectors — fetch from Clone API/DB into warehouse.
 * One warehouse JSON item per source record (demo_id).
 */

export const DEMO_SOURCE_PDFS = {
  standards: 'standards_demo.pdf',
  qco: 'qco_demo.pdf',
  certification: 'certification_demo.pdf',
  laboratories: 'laboratories_demo.pdf',
  hallmarking: 'hallmarking_demo.pdf',
  consumer: 'consumer_complaints_demo.pdf',
  enforcement: 'enforcement_demo.pdf',
  surveillance: 'surveillance_demo.pdf',
};

export const DEMO_INGEST_CONNECTORS = {
  demo_standards_api: {
    id: 'demo_standards_api',
    dataset: 'standards',
    section: 'standards',
    sourcePdf: DEMO_SOURCE_PDFS.standards,
    apiPath: '/api/demo/standards',
    dbSql: 'SELECT * FROM standards WHERE demo_id IS NOT NULL ORDER BY is_number',
    filterDemo: false,
    recordId: r => r.demo_id,
    title: r => `${r.is_number || r.demo_id} — ${r.title || 'Standard'}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
  demo_qco_api: {
    id: 'demo_qco_api',
    dataset: 'qco',
    section: 'schemes',
    sourcePdf: DEMO_SOURCE_PDFS.qco,
    apiPath: '/api/qco',
    dbSql: 'SELECT * FROM qco_orders WHERE demo_id IS NOT NULL ORDER BY effective_date DESC',
    filterDemo: true,
    recordId: r => r.demo_id,
    title: r => `${r.gazette_ref || r.demo_id} — ${r.product || 'QCO'}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
  demo_certification_api: {
    id: 'demo_certification_api',
    dataset: 'certification',
    section: 'schemes',
    sourcePdf: DEMO_SOURCE_PDFS.certification,
    apiPath: '/api/certification-registry',
    dbSql: 'SELECT * FROM mock_licensed_manufacturers WHERE demo_id IS NOT NULL ORDER BY cml_number',
    filterDemo: false,
    recordId: r => r.demo_id,
    title: r => `CML ${r.cml_number || ''} — ${r.company_name || r.demo_id}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
  demo_laboratories_api: {
    id: 'demo_laboratories_api',
    dataset: 'laboratories',
    section: 'labs',
    sourcePdf: DEMO_SOURCE_PDFS.laboratories,
    apiPath: '/api/labs',
    dbSql: 'SELECT * FROM labs WHERE demo_id IS NOT NULL ORDER BY name',
    filterDemo: true,
    recordId: r => r.demo_id,
    title: r => r.name || r.demo_id,
    isNumbers: () => [],
  },
  demo_hallmarking_huid_api: {
    id: 'demo_hallmarking_huid_api',
    dataset: 'hallmarking',
    section: 'hallmarking',
    sourcePdf: DEMO_SOURCE_PDFS.hallmarking,
    apiPath: '/api/huid-ledger',
    dbSql: 'SELECT * FROM mock_huid_ledger WHERE demo_id IS NOT NULL ORDER BY huid',
    filterDemo: false,
    recordId: r => r.demo_id,
    title: r => `HUID ${r.huid || r.demo_id}`,
    isNumbers: () => [],
  },
  demo_consumer_complaints_api: {
    id: 'demo_consumer_complaints_api',
    dataset: 'consumer_complaints',
    section: 'consumer',
    sourcePdf: DEMO_SOURCE_PDFS.consumer,
    apiPath: '/api/consumer/grievances',
    dbSql: 'SELECT * FROM mock_grievances WHERE demo_id IS NOT NULL ORDER BY created_at DESC',
    filterDemo: true,
    recordId: r => r.demo_id || r.ticket_id,
    title: r => `Complaint ${r.ticket_id || r.demo_id}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
  demo_enforcement_api: {
    id: 'demo_enforcement_api',
    dataset: 'enforcement',
    section: 'schemes',
    sourcePdf: DEMO_SOURCE_PDFS.enforcement,
    apiPath: '/api/enforcement/cases',
    dbSql: 'SELECT * FROM enforcement_cases ORDER BY inspection_date DESC',
    filterDemo: false,
    recordId: r => r.demo_id || r.case_id,
    title: r => `Enforcement ${r.case_id || r.demo_id}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
  demo_surveillance_api: {
    id: 'demo_surveillance_api',
    dataset: 'surveillance',
    section: 'schemes',
    sourcePdf: DEMO_SOURCE_PDFS.surveillance,
    apiPath: '/api/surveillance',
    dbSql: 'SELECT * FROM surveillance_cases ORDER BY surveillance_date DESC',
    filterDemo: false,
    recordId: r => r.demo_id || r.surveillance_id,
    title: r => `Surveillance ${r.surveillance_id || r.demo_id}`,
    isNumbers: r => (r.is_number ? [r.is_number] : []),
  },
};

export function isDemoIngestConnector(connectorId) {
  return Boolean(DEMO_INGEST_CONNECTORS[connectorId]);
}

export function getDemoConnector(connectorId) {
  return DEMO_INGEST_CONNECTORS[connectorId] || null;
}

function srcRef(dataset, demoId) {
  return `BIS MITRA Demo → ${dataset} → ${demoId}`;
}

function normalizeRecords(data, def) {
  const rows = Array.isArray(data) ? data : (data?.records || data?.results || []);
  if (!def.filterDemo) return rows;
  return rows.filter(r => r.demo_id);
}

export function buildDemoApiPayload(def, data, via = 'api') {
  const records = normalizeRecords(data, def);
  return {
    via,
    dataset: def.dataset,
    connector: def.id,
    count: records.length,
    records,
  };
}

export function buildDemoDbPayload(def, rows) {
  return buildDemoApiPayload(def, rows, 'db');
}

/**
 * Map fetch result → warehouse items (one JSON artifact per demo record).
 */
export function warehouseItemsFromDemoIngest(plan, runResult) {
  const def = getDemoConnector(plan.connector);
  if (!def) return [];

  const first = runResult.results?.[0];
  if (!first?.success || !first.payload) return [];

  const records = first.payload.records || [];
  if (!records.length) return [];

  const now = new Date().toISOString();
  const sourceKey = plan.id;
  const via = first.via || plan.method || 'api';
  const items = [];

  for (const record of records) {
    const demoId = def.recordId(record);
    if (!demoId) continue;

    const safeId = String(demoId).replace(/[^a-zA-Z0-9._-]/g, '_');
    const title = def.title(record);
    const sourceRef = record.source_reference || srcRef(def.dataset, demoId);
    const sourceFile = record.source_file || def.sourcePdf;

    items.push({
      id: `w-${sourceKey}-${safeId}`,
      sourceKey,
      source: 'fetch',
      planId: plan.id,
      updatedAt: now,
      fetchMethod: via,
      name: `${def.dataset}-${safeId}.json`,
      domain: def.section,
      type: 'JSON',
      content: {
        dataset: def.dataset,
        demo_id: demoId,
        record,
        source_file: sourceFile,
        source_reference: sourceRef,
        source_type: via === 'db' ? 'sqlite' : 'clone_api',
      },
      meta: {
        demo_id: demoId,
        dataset: def.dataset,
        title,
        is_number: record.is_number || null,
        source_file: sourceFile,
        source_reference: sourceRef,
        sourceUrl: `demo://${sourceFile}#${demoId}`,
      },
      regulatory: {
        legal_status: 'synthetic_demo',
        stamped_at: now,
      },
    });
  }

  return items;
}
