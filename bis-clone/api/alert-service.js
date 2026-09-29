import db from './db.js';

/** Map BIS content categories → MITRA user personas that should be notified. */
export const CATEGORY_PERSONAS = {
  Certification: ['industry', 'lab_testing'],
  Standards: ['industry', 'enforcement', 'lab_testing'],
  QCO: ['industry', 'foreign_exporter', 'enforcement'],
  Hallmarking: ['gold_investor', 'citizen'],
  Labs: ['lab_testing', 'industry'],
  Consumer: ['citizen'],
  Recall: ['citizen', 'enforcement'],
  CRS: ['foreign_exporter', 'industry'],
  Export: ['foreign_exporter', 'enforcement'],
  Enforcement: ['enforcement', 'industry'],
  General: ['industry', 'citizen'],
  Academic: ['academic'],
  Research: ['academic'],
};

export function parsePersonas(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(raw).split(',').map(s => s.trim()).filter(Boolean);
  }
}

export function createComplianceAlert({
  title,
  summary,
  severity = 'warning',
  is_number = null,
  target_personas = [],
  source = 'bis-portal',
  change_type = 'update',
}) {
  const personas = [...new Set(target_personas)];
  const info = db.prepare(
    `INSERT INTO compliance_alerts (title, summary, severity, is_number, target_personas, source, change_type, published_at, acknowledged)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`
  ).run(
    title,
    summary || '',
    severity,
    is_number,
    JSON.stringify(personas),
    source,
    change_type,
  );
  bumpFingerprint('standards');
  return db.prepare('SELECT * FROM compliance_alerts WHERE id = ?').get(info.lastInsertRowid);
}

export function bumpFingerprint(domain = 'standards') {
  const fp = `${domain}-${Date.now()}`;
  db.prepare(
    `INSERT INTO standard_fingerprints (domain, fingerprint, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(domain) DO UPDATE SET fingerprint = excluded.fingerprint, updated_at = excluded.updated_at`
  ).run(domain, fp);
  return fp;
}

export function listComplianceAlerts({ unacknowledged, persona } = {}) {
  let sql = 'SELECT * FROM compliance_alerts WHERE 1=1';
  if (unacknowledged) sql += ' AND acknowledged = 0';
  sql += ' ORDER BY published_at DESC, id DESC LIMIT 50';
  const rows = db.prepare(sql).all();
  if (!persona) return rows;
  return rows.filter(row => {
    const targets = parsePersonas(row.target_personas);
    return !targets.length || targets.includes(persona);
  });
}

export function personasForCategory(category) {
  return CATEGORY_PERSONAS[category] || CATEGORY_PERSONAS.General;
}
