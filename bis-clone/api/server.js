import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import db from './db.js';
import {
  createComplianceAlert,
  listComplianceAlerts,
  personasForCategory,
  bumpFingerprint,
} from './alert-service.js';
import {
  ensureWorkflowTables,
  seedWorkflowInstances,
  listServices,
  getService,
  discoverService,
  lookupStatus,
  getWorkflowById,
} from './workflow-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = 'bis-clone-demo-secret';
const FILES_DIR = path.join(__dirname, '..', 'public', 'files');
const KNOWLEDGE_PDFS_DIR = path.join(__dirname, '..', 'data', 'knowledge', 'pdfs');

app.use(cors());
app.use(express.json());
app.use('/files', express.static(FILES_DIR));
app.use('/files/knowledge/pdfs', express.static(KNOWLEDGE_PDFS_DIR));

const MITRA_ADMIN_URL = (process.env.MITRA_ADMIN_URL || 'http://localhost:5050').replace(/\/$/, '');

async function notifyMitraStatus(payload) {
  try {
    await fetch(`${MITRA_ADMIN_URL}/api/agent/application-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[mitra-notify]', err.message);
  }
}

const FILES_BASE = `http://localhost:${PORT}/files`;
function withPdfUrl(row) {
  if (!row) return row;
  return {
    ...row,
    pdf_url: row.pdf_path ? `${FILES_BASE}/${row.pdf_path}` : null,
  };
}

// Auth
app.post('/api/auth/login', (req, res) => {
  const { email, username, password, captcha } = req.body;
  const loginId = email || username;
  if (captcha !== '1234') {
    return res.status(400).json({ error: 'Invalid captcha' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(loginId, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Standards
app.get('/api/standards', (req, res) => {
  const { q, is_number } = req.query;
  if (is_number) {
    const std = db.prepare('SELECT * FROM standards WHERE is_number = ?').get(is_number);
    return res.json(std || null);
  }
  if (q) {
    const like = `%${q}%`;
    const rows = db.prepare(
      `SELECT DISTINCT s.* FROM standards s
       LEFT JOIN layman_synonyms syn ON syn.is_number = s.is_number
       WHERE s.is_number LIKE ? OR s.title LIKE ? OR s.description LIKE ? OR s.department LIKE ?
         OR syn.colloquial LIKE ? OR syn.formal_terms LIKE ?
       ORDER BY s.is_number LIMIT 30`
    ).all(like, like, like, like, like, like);
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM standards ORDER BY is_number').all());
});

app.get('/api/standards/:isNumber/referred', (req, res) => {
  const rows = db.prepare('SELECT * FROM referred_standards WHERE parent_is = ?').all(req.params.isNumber);
  res.json(rows);
});

app.get('/api/standards/:isNumber/detail', (req, res) => {
  const isNumber = decodeURIComponent(req.params.isNumber);
  const standard = db.prepare('SELECT * FROM standards WHERE is_number = ?').get(isNumber);
  if (!standard) return res.status(404).json({ error: 'Standard not found' });
  const referred = db.prepare('SELECT * FROM referred_standards WHERE parent_is = ?').all(isNumber);
  const manual = db.prepare('SELECT * FROM product_manuals WHERE is_number = ?').get(isNumber);
  const fee = db.prepare('SELECT * FROM marking_fees WHERE is_number = ?').get(isNumber);
  const FILES_BASE = `http://localhost:${PORT}/files`;
  res.json({
    standard,
    referred_standards: referred,
    product_manual: manual ? { ...manual, pdf_url: `${FILES_BASE}/${manual.pdf_path}` } : null,
    marking_fee: fee || null,
    compulsory: standard.mandatory_voluntary === 'Mandatory',
  });
});

// Product manuals
app.get('/api/product-manuals', (req, res) => {
  const { q } = req.query;
  if (q) {
    const rows = db.prepare(
      `SELECT * FROM product_manuals WHERE is_number LIKE ? OR title LIKE ? ORDER BY sr_no`
    ).all(`%${q}%`, `%${q}%`);
    return res.json(rows.map(withPdfUrl));
  }
  res.json(db.prepare('SELECT * FROM product_manuals ORDER BY sr_no').all().map(withPdfUrl));
});

// Marking fees
app.get('/api/marking-fees', (req, res) => {
  const { q, is_number } = req.query;
  if (is_number) {
    const row = db.prepare('SELECT * FROM marking_fees WHERE is_number = ?').get(is_number);
    return res.json(row ? [row] : []);
  }
  if (q) {
    const rows = db.prepare(
      `SELECT * FROM marking_fees WHERE keywords LIKE ? OR title LIKE ? OR is_number LIKE ?`
    ).all(`%${q}%`, `%${q}%`, `%${q}%`);
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM marking_fees ORDER BY is_number').all());
});

// Certification list (static table)
app.get('/api/certification-list', (req, res) => {
  const { q } = req.query;
  if (q) {
    const like = `%${q}%`;
    const rows = db.prepare(
      `SELECT is_number as standard_number, title as standard_title, mandatory_voluntary FROM standards
       WHERE is_number LIKE ? OR title LIKE ? ORDER BY is_number LIMIT 20`
    ).all(like, like);
    return res.json(rows);
  }
  const rows = db.prepare(
    `SELECT is_number as standard_number, title as standard_title, mandatory_voluntary FROM standards ORDER BY is_number`
  ).all();
  res.json(rows);
});

// Compulsory certification products
app.get('/api/compulsory-products', (req, res) => {
  const { q } = req.query;
  let sql = `SELECT is_number, title, pdf_path, 'ISI (Scheme-I)' as scheme FROM standards WHERE mandatory_voluntary = 'Mandatory'`;
  const params = [];
  if (q) {
    sql += ` AND (is_number LIKE ? OR title LIKE ? OR description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY is_number`;
  const rows = db.prepare(sql).all(...params);
  const FILES_BASE = `http://localhost:${PORT}/files`;
  res.json(rows.map(r => ({
    is_number: r.is_number,
    title: r.title,
    scheme: r.scheme,
    manual_path: r.pdf_path ? `${FILES_BASE}/${r.pdf_path}` : null,
  })));
});

// Process documents
app.get('/api/process-documents', (_req, res) => {
  res.json(db.prepare('SELECT * FROM process_documents ORDER BY id').all().map(withPdfUrl));
});

app.get('/api/documents', (req, res) => {
  const domain = req.query.domain;
  let sql = 'SELECT * FROM portal_documents';
  const params = [];
  if (domain) {
    sql += ' WHERE domain = ?';
    params.push(domain);
  }
  sql += ' ORDER BY domain, id';
  try {
    res.json(db.prepare(sql).all(...params).map(withPdfUrl));
  } catch {
    res.json([]);
  }
});

// News (public list + demo CRUD so Clone B changes show up in admin fetch)
app.get('/api/news', (req, res) => {
  const { q, category } = req.query;
  if (q || category) {
    let sql = 'SELECT * FROM news WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (title LIKE ? OR summary LIKE ? OR category LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      sql += ' AND category LIKE ?';
      params.push(`%${category}%`);
    }
    sql += ' ORDER BY published_at DESC, id DESC LIMIT 20';
    return res.json(db.prepare(sql).all(...params));
  }
  res.json(db.prepare('SELECT * FROM news ORDER BY published_at DESC, id DESC').all());
});

app.post('/api/news', (req, res) => {
  const { title, summary, published_at, category, source_url, notify_personas } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const date = published_at || new Date().toISOString().slice(0, 10);
  const cat = category || 'General';
  const info = db.prepare(
    `INSERT INTO news (title, summary, published_at, category, source_url) VALUES (?,?,?,?,?)`
  ).run(title.trim(), summary || '', date, cat, source_url || '/news');
  const row = db.prepare('SELECT * FROM news WHERE id = ?').get(info.lastInsertRowid);
  const personas = notify_personas?.length ? notify_personas : personasForCategory(cat);
  const alert = createComplianceAlert({
    title: `BIS News: ${title.trim()}`,
    summary: summary || `New ${cat} announcement published on bis.gov.in portal.`,
    severity: cat === 'Recall' || cat === 'Enforcement' ? 'critical' : 'warning',
    target_personas: personas,
    source: 'bis-news',
    change_type: 'news',
  });
  bumpFingerprint('news');
  res.status(201).json({ ...row, alert_id: alert.id, notified_personas: personas });
});

app.put('/api/news/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const title = req.body.title ?? existing.title;
  const summary = req.body.summary ?? existing.summary;
  const published_at = req.body.published_at ?? existing.published_at;
  const category = req.body.category ?? existing.category;
  const source_url = req.body.source_url ?? existing.source_url;
  db.prepare(
    `UPDATE news SET title=?, summary=?, published_at=?, category=?, source_url=? WHERE id=?`
  ).run(title, summary, published_at, category, source_url, req.params.id);
  res.json(db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id));
});

app.delete('/api/news/:id', (req, res) => {
  const info = db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Demo: rename / update product manual so admin fetch reflects Clone B changes
app.patch('/api/product-manuals/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM product_manuals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const title = req.body.title ?? existing.title;
  const pdf_path = req.body.pdf_path ?? existing.pdf_path;
  const is_number = req.body.is_number ?? existing.is_number;
  const size_mb = req.body.size_mb ?? existing.size_mb;
  db.prepare(
    `UPDATE product_manuals SET title=?, pdf_path=?, is_number=?, size_mb=? WHERE id=?`
  ).run(title, pdf_path, is_number, size_mb, req.params.id);
  res.json(db.prepare('SELECT * FROM product_manuals WHERE id = ?').get(req.params.id));
});

// Applications
function applicationHistory(referenceId) {
  return db.prepare(
    `SELECT old_status, new_status, changed_by, changed_at, note
     FROM application_status_history WHERE reference_id = ? ORDER BY id ASC`
  ).all(referenceId);
}

function withApplicationHistory(row) {
  return row ? { ...row, status_history: applicationHistory(row.reference_id) } : row;
}

function applicationNextAction(status) {
  const actions = {
    Submitted: 'BIS will begin document verification.',
    'Under Review': 'Await document verification by the certification officer.',
    'Query Raised': 'Respond to the query and upload requested documents.',
    'Documents Required': 'Upload the requested supporting documents.',
    'Inspection Scheduled': 'Prepare the factory and product samples for inspection.',
    Testing: 'Product testing is in progress.',
    Granted: 'Licence granted. Download the certificate from eBIS.',
    Certified: 'Certification approved. Download the certificate from eBIS.',
    Rejected: 'Review the rejection reason and available appeal options.',
  };
  return actions[status] || 'Track the application in eBIS.';
}

app.post('/api/applications', (req, res) => {
  const {
    company_name,
    factory_name,
    udyam_id,
    lab_report_ref,
    is_number,
    product_name,
    owner_session_id,
    owner_user_id,
    owner_persona,
    contact_email,
    declaration,
  } = req.body;
  const ref = `BIS-APP-DEMO-${String(Date.now()).slice(-6)}`;
  const submittedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO applications (reference_id, company_name, factory_name, udyam_id, lab_report_ref, is_number, product_name, status,
      owner_session_id, owner_user_id, owner_persona, contact_email, declaration, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?)`
  ).run(
    ref,
    company_name || factory_name,
    factory_name || company_name,
    udyam_id || null,
    lab_report_ref || null,
    is_number,
    product_name || is_number,
    owner_session_id || null,
    owner_user_id || null,
    owner_persona || null,
    contact_email || null,
    declaration || null,
    submittedAt,
  );
  db.prepare(
    `INSERT INTO application_status_history (reference_id, old_status, new_status, changed_by, changed_at, note)
     VALUES (?, NULL, 'Submitted', 'BIS MITRA Agent', ?, 'Application submitted after user confirmation')`
  ).run(ref, submittedAt);
  db.prepare(
    `INSERT OR REPLACE INTO ebis_workflow_instances
     (workflow_id, service_id, persona, record_type, record_id, application_id, applicant_name,
      submitted_at, current_status, current_step, next_action, status_history, assigned_department,
      related_standard, evidence_refs, source, demo_id, last_updated)
     VALUES (?, 'SVC-CERT-001', 'industry', 'application', ?, ?, ?, ?, 'Submitted',
      'Application Submitted', ?, ?, 'Product Certification', ?, ?, 'eBIS Applications', ?, ?)`
  ).run(
    `WF-${ref}`,
    ref,
    ref,
    company_name || factory_name,
    submittedAt,
    applicationNextAction('Submitted'),
    JSON.stringify([{ status: 'Submitted', at: submittedAt, changed_by: 'BIS MITRA Agent' }]),
    is_number,
    JSON.stringify([
      { type: 'lab_report', reference: lab_report_ref || null },
      { type: 'declaration', status: declaration || null },
    ]),
    ref,
    submittedAt,
  );
  res.json({
    reference_id: ref,
    tracking_id: ref,
    status: 'Submitted',
    submitted_at: submittedAt,
    message: 'Application submitted successfully',
  });
});

app.get('/api/applications', (req, res) => {
  const { q, reference_id, company_name, is_number } = req.query;
  if (reference_id) {
    const row = db.prepare('SELECT * FROM applications WHERE reference_id = ?').get(reference_id);
    return res.json(row ? [withApplicationHistory(row)] : []);
  }
  if (q || company_name || is_number) {
    const term = q || company_name || is_number;
    const like = `%${term}%`;
    const rows = db.prepare(
      `SELECT * FROM applications WHERE reference_id LIKE ? OR company_name LIKE ? OR is_number LIKE ? OR product_name LIKE ? ORDER BY submitted_at DESC LIMIT 20`
    ).all(like, like, like, like);
    return res.json(rows.map(withApplicationHistory));
  }
  res.json(
    db.prepare('SELECT * FROM applications ORDER BY submitted_at DESC, id DESC')
      .all()
      .map(withApplicationHistory)
  );
});

const APP_STATUSES = [
  'Submitted',
  'Under Review',
  'Query Raised',
  'Documents Required',
  'Inspection Scheduled',
  'Testing',
  'Granted',
  'Certified',
  'Rejected',
];

app.patch('/api/applications/:referenceId', async (req, res) => {
  const referenceId = req.params.referenceId;
  const existing = db.prepare('SELECT * FROM applications WHERE reference_id = ?').get(referenceId);
  if (!existing) return res.status(404).json({ error: 'Application not found' });
  const status = String(req.body.status || '').trim();
  if (!APP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${APP_STATUSES.join(', ')}` });
  }
  const changedBy = String(req.body.changed_by || req.body.changedBy || 'BIS Certification Officer').trim();
  const changedAt = new Date().toISOString();
  const note = String(req.body.note || '').trim() || null;
  db.prepare('UPDATE applications SET status = ? WHERE reference_id = ?').run(status, referenceId);
  db.prepare(
    `INSERT INTO application_status_history (reference_id, old_status, new_status, changed_by, changed_at, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(referenceId, existing.status, status, changedBy, changedAt, note);
  const workflow = db.prepare(
    'SELECT * FROM ebis_workflow_instances WHERE record_id = ? OR application_id = ?'
  ).get(referenceId, referenceId);
  if (workflow) {
    let history = [];
    try { history = JSON.parse(workflow.status_history || '[]'); } catch { history = []; }
    history.push({ status, at: changedAt, changed_by: changedBy, note });
    db.prepare(
      `UPDATE ebis_workflow_instances
       SET current_status = ?, current_step = ?, next_action = ?, status_history = ?, last_updated = ?
       WHERE workflow_id = ?`
    ).run(status, status, applicationNextAction(status), JSON.stringify(history), changedAt, workflow.workflow_id);
  }
  const row = withApplicationHistory(
    db.prepare('SELECT * FROM applications WHERE reference_id = ?').get(referenceId)
  );
  await notifyMitraStatus({
    reference_id: referenceId,
    status,
    previous_status: existing.status,
    product_name: row.product_name,
    session_id: row.owner_session_id,
    user_id: row.owner_user_id,
    persona: row.owner_persona,
    scheme: 'scheme-i',
    changed_by: changedBy,
    changed_at: changedAt,
  });
  res.json(row);
});

app.get('/api/licences', (req, res) => {
  const { q, org_id } = req.query;
  if (org_id) {
    const rows = db.prepare('SELECT * FROM licences WHERE org_id = ?').all(org_id);
    return res.json(rows);
  }
  if (q) {
    const like = `%${q}%`;
    const rows = db.prepare(
      `SELECT * FROM licences WHERE licence_number LIKE ? OR org_id LIKE ? OR company_name LIKE ? OR is_number LIKE ? OR product_name LIKE ? LIMIT 20`
    ).all(like, like, like, like, like);
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM licences ORDER BY licence_number').all());
});

app.get('/api/hallmarking-centres', (req, res) => {
  const { q, state, district } = req.query;
  let sql = 'SELECT * FROM hallmarking_centres WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR city LIKE ? OR district LIKE ? OR state LIKE ? OR centre_id LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (state) {
    sql += ' AND state LIKE ?';
    params.push(`%${state}%`);
  }
  if (district) {
    sql += ' AND district LIKE ?';
    params.push(`%${district}%`);
  }
  sql += ' ORDER BY state, city LIMIT 20';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/labs', (req, res) => {
  const { q, group, capability, city } = req.query;
  let sql = 'SELECT * FROM labs WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR city LIKE ? OR scope LIKE ? OR lab_code LIKE ? OR capability LIKE ? OR state LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (city) {
    sql += ' AND city LIKE ?';
    params.push(`%${city}%`);
  }
  if (capability) {
    sql += ' AND (capability LIKE ? OR scope LIKE ?)';
    params.push(`%${capability}%`, `%${capability}%`);
  }
  if (group) {
    sql += ' AND group_type LIKE ?';
    params.push(`%${group}%`);
  }
  sql += ' ORDER BY queue_time_weeks ASC, group_type, name LIMIT 20';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/consumer', (req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT * FROM consumer_topics WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR keywords LIKE ? OR slug LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (category) {
    sql += ' AND category LIKE ?';
    params.push(`%${category}%`);
  }
  sql += ' ORDER BY category, title LIMIT 50';
  res.json(db.prepare(sql).all(...params).map(withPdfUrl));
});

app.get('/api/qco', (req, res) => {
  const { q, scheme, sector, is_number } = req.query;
  let sql = 'SELECT * FROM qco_orders WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (product LIKE ? OR is_number LIKE ? OR keywords LIKE ? OR gazette_ref LIKE ? OR sector LIKE ? OR ministry LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (is_number) {
    sql += ' AND is_number LIKE ?';
    params.push(`%${is_number}%`);
  }
  if (scheme) {
    sql += ' AND scheme LIKE ?';
    params.push(`%${scheme}%`);
  }
  if (sector) {
    sql += ' AND sector LIKE ?';
    params.push(`%${sector}%`);
  }
  sql += ' ORDER BY effective_date DESC LIMIT 50';
  const rows = db.prepare(sql).all(...params).map(row => {
    const today = new Date();
    const deadline = row.effective_date ? new Date(row.effective_date + 'T00:00:00') : null;
    let enforcement_status = 'VOLUNTARY';
    if (deadline) {
      enforcement_status = today >= deadline ? 'MANDATORY' : 'TRANSITIONAL_PHASE';
    }
    return { ...row, enforcement_status };
  });
  res.json(rows);
});

app.get('/api/sit', (req, res) => {
  const { q, is_number } = req.query;
  let sql = 'SELECT * FROM sit_manuals WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR is_number LIKE ? OR summary LIKE ? OR testing_machinery LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (is_number) {
    sql += ' AND is_number LIKE ?';
    params.push(`%${is_number}%`);
  }
  sql += ' ORDER BY is_number LIMIT 20';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/synonyms', (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM layman_synonyms WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (colloquial LIKE ? OR formal_terms LIKE ? OR is_number LIKE ? OR notes LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY colloquial LIMIT 50';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/certification-roadmap', (req, res) => {
  const isNumber = req.query.is_number || req.query.isNumber || 'IS 2082:2018';
  const enterpriseType = req.query.enterprise_type || req.query.enterpriseType || 'micro_msme';
  const fee = db.prepare(
    'SELECT * FROM fee_structures WHERE is_number LIKE ? AND enterprise_type = ?'
  ).get(`%${isNumber.replace(/^IS\s*/i, '').split(':')[0]}%`, enterpriseType)
    || db.prepare(
      'SELECT * FROM fee_structures WHERE is_number LIKE ? ORDER BY msme_discount DESC LIMIT 1'
    ).get(`%${isNumber.replace(/^IS\s*/i, '').split(':')[0]}%`);
  const marking = fee
    ? Math.round(fee.marking_fee * (1 - (fee.msme_discount || 0)))
    : null;
  const steps = [
    'Align your factory line machines per the SIT manual for this standard.',
    'Test a production sample at an independent NABL-accredited lab.',
    'Submit Form-I online with factory details, Udyam ID, and lab report reference.',
    'Schedule BIS factory inspection after document verification.',
    'Receive licence and begin ISI marking upon approval.',
  ];
  res.json({
    is_number: isNumber,
    enterprise_type: enterpriseType,
    procedure: fee?.procedure_name || 'Normal Procedure',
    processing_weeks: fee?.processing_weeks || 8,
    marking_fee_inr: fee?.marking_fee || null,
    msme_discount_pct: Math.round((fee?.msme_discount || 0) * 100),
    final_marking_fee_inr: marking,
    steps,
    notes: fee?.notes || null,
  });
});

app.get('/api/guidance', (req, res) => {
  const { q, slug } = req.query;
  if (slug) {
    const row = db.prepare('SELECT * FROM regulatory_guidance WHERE slug = ?').get(slug);
    return res.json(row ? [row] : []);
  }
  let sql = 'SELECT * FROM regulatory_guidance WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR content LIKE ? OR keywords LIKE ? OR slug LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY title LIMIT 200';
  res.json(db.prepare(sql).all(...params).map(withPdfUrl));
});

app.get('/api/compliance-alerts', (req, res) => {
  const unacknowledged = req.query.unacknowledged === '1' || req.query.unacknowledged === 'true';
  const persona = req.query.persona || null;
  res.json(listComplianceAlerts({ unacknowledged, persona }));
});

app.post('/api/compliance-alerts/:id/acknowledge', (req, res) => {
  const info = db.prepare('UPDATE compliance_alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/v1/fingerprint/standards', (_req, res) => {
  const row = db.prepare('SELECT * FROM standard_fingerprints WHERE domain = ?').get('standards');
  const amendments = db.prepare('SELECT * FROM standard_amendments ORDER BY published_at DESC LIMIT 10').all();
  res.json({
    domain: 'standards',
    fingerprint: row?.fingerprint || 'baseline',
    updated_at: row?.updated_at || null,
    amendment_count: amendments.length,
    amendments,
  });
});

app.get('/api/amendments', (req, res) => {
  const { is_number, q } = req.query;
  let sql = 'SELECT * FROM standard_amendments WHERE 1=1';
  const params = [];
  if (is_number) {
    sql += ' AND is_number LIKE ?';
    params.push(`%${is_number}%`);
  }
  if (q) {
    sql += ' AND (clause_ref LIKE ? OR summary LIKE ? OR amendment_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY published_at DESC LIMIT 20';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/demo/publish-amendment', (_req, res) => {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO standard_amendments (is_number, amendment_no, clause_ref, old_value, new_value, summary, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'IS 4151:2015',
    'Amendment 1',
    'Clause 4.2.1',
    '300g maximum deceleration velocity',
    '250g maximum deceleration velocity',
    'Shock absorption peak threshold tightened for two-wheeler helmets.',
    now,
  );
  const fp = bumpFingerprint('standards');
  const alert = createComplianceAlert({
    title: 'CRITICAL: Amendment 1 to IS 4151:2018 published',
    summary: 'Clause 4.2.1 shock absorption limit changed from 300g to 250g maximum deceleration. Recalibrate impact sensors immediately.',
    severity: 'critical',
    is_number: 'IS 4151:2015',
    target_personas: ['industry', 'enforcement', 'lab_testing'],
    source: 'bis-standards-amendment',
    change_type: 'amendment',
  });
  res.json({ ok: true, fingerprint: fp, alert_id: alert.id, published_at: now, notified_personas: ['industry', 'enforcement', 'lab_testing'] });
});

/** Ministry demo console — one-click portal changes that fan out persona-targeted alerts */
app.post('/api/demo/actions/:actionId', (req, res) => {
  const { actionId } = req.params;
  const now = new Date().toISOString().slice(0, 10);
  let result = { ok: true, action: actionId };

  switch (actionId) {
    case 'hallmarking-expansion': {
      const news = db.prepare(
        `INSERT INTO news (title, summary, published_at, category, source_url) VALUES (?,?,?,?,?)`
      ).run(
        'Mandatory hallmarking expanded to 12 new districts',
        'Phase-VI mandatory hallmarking now covers Jaipur, Surat, and 10 additional districts effective immediately.',
        now, 'Hallmarking', '/news',
      );
      result.news_id = news.lastInsertRowid;
      result.alert = createComplianceAlert({
        title: 'Hallmarking jurisdiction expanded',
        summary: 'New districts added to mandatory hallmarking Phase-VI. Jewellers must register AHC appointments.',
        severity: 'warning',
        target_personas: ['gold_investor', 'citizen'],
        source: 'bis-hallmarking',
        change_type: 'policy',
      });
      break;
    }
    case 'consumer-recall': {
      result.alert = createComplianceAlert({
        title: 'Product recall: non-compliant electric water heaters',
        summary: 'Batch REC-GYS-2026 flagged for missing IS 2082 certification. Consumers may file complaints via BIS portal.',
        severity: 'critical',
        is_number: 'IS 2082:2018',
        target_personas: ['citizen', 'enforcement', 'industry'],
        source: 'bis-consumer',
        change_type: 'recall',
      });
      break;
    }
    case 'crs-deadline': {
      result.alert = createComplianceAlert({
        title: 'CRS registration deadline — LED lamps (IS 15844)',
        summary: 'Foreign manufacturers must complete CRS registration before customs clearance after 30 days.',
        severity: 'critical',
        is_number: 'IS 15844:2010',
        target_personas: ['foreign_exporter', 'enforcement'],
        source: 'bis-crs',
        change_type: 'deadline',
      });
      break;
    }
    case 'lab-recognition': {
      db.prepare(
        `UPDATE labs SET queue_time_weeks = queue_time_weeks + 1 WHERE city = 'Pune'`
      ).run();
      result.alert = createComplianceAlert({
        title: 'Lab recognition list updated — Pune queue increased',
        summary: 'National Test House Pune backlog now 3 weeks. NABL scope verification required for IS 2082.',
        severity: 'warning',
        is_number: 'IS 2082:2018',
        target_personas: ['lab_testing', 'industry'],
        source: 'bis-labs',
        change_type: 'registry',
      });
      bumpFingerprint('labs');
      break;
    }
    case 'qco-steel': {
      result.alert = createComplianceAlert({
        title: 'QCO enforcement notice — structural steel at border',
        summary: 'Customs to detain imports lacking valid IS 2062 test certificates effective immediately.',
        severity: 'critical',
        is_number: 'IS 2062:2011',
        target_personas: ['foreign_exporter', 'enforcement', 'industry'],
        source: 'bis-qco',
        change_type: 'qco',
      });
      break;
    }
    case 'fmcs-border-alert': {
      result.alert = createComplianceAlert({
        title: 'CRITICAL: FMCS import mandate — overnight amendment to electronics standard',
        summary: 'Amendment 3 to FMCS index detected at 04:30 AM. Electronic component imports (IS 13252, IS 15844) now require updated CRS registration with new EMI test clause. Shipments at Chennai, Mumbai, and JNPT ports flagged for priority compliance review.',
        severity: 'critical',
        target_personas: ['foreign_exporter', 'enforcement'],
        source: 'bis-fmcs',
        change_type: 'fmcs_amendment',
      });
      bumpFingerprint('fmcs');
      result.news_id = db.prepare(
        `INSERT INTO news (title, summary, published_at, category, source_url) VALUES (?,?,?,?,?)`
      ).run(
        'FMCS Amendment 3: Updated EMI test clause for electronics imports',
        'BIS has notified Amendment 3 to the FMCS index covering IS 13252 and IS 15844. Foreign manufacturers must update CRS registration with new EMI conformity documentation.',
        new Date().toISOString().slice(0, 10), 'FMCS', '/news',
      ).lastInsertRowid;
      break;
    }
    case 'fmcs-customs-detention': {
      result.alert = createComplianceAlert({
        title: 'Customs detention notice: European automotive electronics without FMCS license',
        summary: 'JNPT and Chennai customs have issued detention orders for automotive ECU shipments lacking valid IS 16046 FMCS license. Contact your AIR immediately to expedite clearance documentation.',
        severity: 'critical',
        target_personas: ['foreign_exporter', 'enforcement'],
        source: 'bis-fmcs',
        change_type: 'customs_detention',
      });
      bumpFingerprint('fmcs');
      break;
    }
    case 'mra-activated': {
      result.alert = createComplianceAlert({
        title: 'MRA activated: EU test reports now accepted for IS 2082 FMCS applications',
        summary: 'India-EU Technical Cooperation Agreement expanded. European manufacturers of IS 2082 water heaters may now submit CE/VDE test reports in lieu of Indian lab testing. Saves 4–6 weeks processing time.',
        severity: 'warning',
        target_personas: ['foreign_exporter'],
        source: 'bis-mra',
        change_type: 'mra_update',
      });
      break;
    }
    case 'publish-amendment': {
      db.prepare(
        `INSERT INTO standard_amendments (is_number, amendment_no, clause_ref, old_value, new_value, summary, published_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run('IS 4151:2015', 'Amendment 1', 'Clause 4.2.1', '300g maximum deceleration velocity', '250g maximum deceleration velocity', 'Shock absorption peak threshold tightened.');
      result.fingerprint = bumpFingerprint('standards');
      result.alert = createComplianceAlert({
        title: 'CRITICAL: Amendment 1 to IS 4151:2018 published',
        summary: 'Clause 4.2.1: 300g → 250g max deceleration. Recalibrate impact sensors.',
        severity: 'critical',
        is_number: 'IS 4151:2015',
        target_personas: ['industry', 'enforcement', 'lab_testing'],
        source: 'bis-standards-amendment',
        change_type: 'amendment',
      });
      break;
    }
    case 'toy-safety-ban': {
      result.alert = createComplianceAlert({
        title: 'URGENT CITIZEN SAFETY ADVISORY: IS 9873 Toy Toxicity Recall',
        summary: 'BIS market surveillance seized non-compliant plastic building blocks exceeding statutory Lead limits (found > 90 mg/kg). Parents are advised to verify ISI marking under IS 9873.',
        severity: 'critical',
        is_number: 'IS 9873 (Part 3):2017',
        target_personas: ['citizen', 'enforcement'],
        source: 'bis-toy-cell',
        change_type: 'recall',
      });
      bumpFingerprint('standards');
      break;
    }
    case 'grievance-officer-assigned': {
      try {
        db.prepare(
          `UPDATE mock_grievances SET status = 'OFFICER_ASSIGNED', action = 'Surprise sample collection ordered', officer_notes = 'A BIS field enforcement officer has been officially assigned to pull retail samples of this batch within 48 hours.', updated_at = datetime('now') WHERE ticket_id = 'CON-GRP-4401'`
        ).run();
      } catch { /* ignore */ }
      result.alert = createComplianceAlert({
        title: 'COMPLAINT STATUS UPDATE 🚨 Ticket CON-GRP-4401: Officer Assigned',
        summary: 'Your ticket CON-GRP-4401 has changed status from Pending to Under Investigation. A BIS field enforcement officer has been officially assigned to pull retail samples of this batch within 48 hours.',
        severity: 'critical',
        target_personas: ['citizen'],
        source: 'bis-grievance-cell',
        change_type: 'grievance_status',
      });
      bumpFingerprint('news');
      break;
    }
    case 'counterfeit-helmet-seizure': {
      result.alert = createComplianceAlert({
        title: 'COUNTERFEIT WARNING ❌ Seizure of helmets with invalid license CM/L-4151999',
        summary: 'BIS enforcement teams have confiscated 450 counterfeit helmets bearing expired license CM/L-4151999 (FakeArmor Helmets). Do not purchase; illegal safety risk under IS 4151.',
        severity: 'critical',
        is_number: 'IS 4151:2015',
        target_personas: ['citizen', 'enforcement'],
        source: 'bis-surveillance',
        change_type: 'counterfeit',
      });
      bumpFingerprint('standards');
      break;
    }
    case 'lab-validation-fail': {
      try {
        db.prepare(
          `INSERT INTO validation_logs (upload_id, row_number, field_name, value_recorded, threshold_min, is_number, error_message)
           VALUES (?,?,?,?,?,?,?)`
        ).run('BULK-UPLOAD-992', 14, 'yield_stress_mpa', '150 MPa', 500, 'IS 1786:2008 Grade Fe 500D',
          'Row 14: yield stress 150 MPa below Fe 500D minimum boundary.');
      } catch { /* ignore */ }
      result.alert = createComplianceAlert({
        title: 'CRITICAL VALIDATION FAILURE — Bulk lab upload rejected',
        summary: 'Row 14 contains yield stress 150 MPa — below IS 1786 Grade Fe 500D threshold. Re-upload required.',
        severity: 'critical',
        is_number: 'IS 1786:2008',
        target_personas: ['lab_testing'],
        source: 'bis-lab-validation',
        change_type: 'validation_failure',
      });
      bumpFingerprint('standards');
      break;
    }
    case 'academic-semester-update': {
      try {
        db.prepare(
          `INSERT INTO semester_publications (is_number, title, amendment_no, summary, published_at) VALUES (?,?,?,?,datetime('now'))`
        ).run('IS 16444:2015', 'Smart Meters', 'Amendment 2', 'Cybersecurity parameters updated for smart metering.', new Date().toISOString().slice(0, 10));
      } catch { /* ignore */ }
      result.alert = createComplianceAlert({
        title: 'New gazette publications this semester',
        summary: 'IS 16444 Amendment 2 and IS 1554 structural revision published — available in academic index.',
        severity: 'info',
        target_personas: ['academic'],
        source: 'bis-gazette',
        change_type: 'publication',
      });
      break;
    }
    case 'enforcement-emergency-seal': {
      try {
        db.prepare(
          `INSERT INTO emergency_seal_orders (order_id, cml_number, legal_authority, status, signed_token) VALUES (?,?,?,?,?)`
        ).run('SEAL-2026-9921', '8830112', 'Section 29, BIS Act 2016', 'EXECUTED', 'SIG-DEMO-SEAL');
        db.prepare(`UPDATE mock_licensed_manufacturers SET status = 'SEALED' WHERE cml_number = '8830112'`).run();
      } catch { /* ignore */ }
      result.alert = createComplianceAlert({
        title: 'EMERGENCY FACTORY SEALING ORDER — SEAL-2026-9921',
        summary: 'Section 29 order executed for CM/L-8830112. Field teams authorized to lock down production lines.',
        severity: 'critical',
        target_personas: ['enforcement', 'industry'],
        source: 'bis-enforcement-desk',
        change_type: 'emergency_seal',
      });
      bumpFingerprint('news');
      break;
    }
    case 'hazard-bottle-alert': {
      const nowTime = new Date().toISOString();
      try {
        db.prepare(
          `INSERT INTO mock_hazard_alerts (hazard_id, product_name, is_number, hazard_category, severity, store_location, report_text, status, notified_cells, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('HAZ-8802', 'Baby feeding bottles', 'IS 14625:2015 / IS 5168', 'Toxic Industrial Plastic', 'critical', 'Local Retail Bazaar', 'Toxic chemical odor detected. High BPA migration risk.', 'DISPATCHED_ENFORCEMENT', '["Regulator Control Desk", "Enforcement Squad"]', nowTime);
      } catch { /* ignore duplicate */ }
      result.alert = createComplianceAlert({
        title: 'CRITICAL PUBLIC HAZARD LOGGED 🚨 Toxic Baby Bottles (HAZ-8802)',
        summary: 'High-priority public health hazard report HAZ-8802 received from citizen. Urgent sample seizure dispatched to regional enforcement squad.',
        severity: 'critical',
        target_personas: ['enforcement', 'citizen'],
        source: 'bis-hazard-desk',
        change_type: 'hazard_alert',
      });
      bumpFingerprint('news');
      break;
    }
    default:
      return res.status(404).json({ error: `Unknown demo action: ${actionId}` });
  }
  bumpFingerprint('news');
  res.json(result);
});

app.get('/api/mock-inspection', (req, res) => {
  const isNumber = req.query.is_number || req.query.isNumber || 'IS 4151:2015';
  const rows = db.prepare(
    'SELECT * FROM inspection_checklists WHERE is_number LIKE ? ORDER BY id'
  ).all(`%${isNumber.replace(/^IS\s*/i, '').split(':')[0]}%`);
  res.json({
    is_number: isNumber,
    checklist: rows,
    total_checks: rows.length,
    critical_checks: rows.filter(r => r.critical).length,
  });
});

app.get('/api/org/:orgId', (req, res) => {
  const orgId = req.params.orgId;
  const licences = db.prepare('SELECT * FROM licences WHERE org_id = ?').all(orgId);
  const companyTerms = licences.map(l => l.company_name).filter(Boolean);
  const apps = [];
  const seen = new Set();
  const batches = [
    db.prepare('SELECT * FROM applications WHERE company_name LIKE ? ORDER BY submitted_at DESC').all(`%${orgId}%`),
    ...companyTerms.map(c =>
      db.prepare('SELECT * FROM applications WHERE company_name LIKE ? ORDER BY submitted_at DESC').all(`%${c}%`)
    ),
  ];
  for (const batch of batches) {
    for (const a of batch) {
      if (!seen.has(a.reference_id)) {
        seen.add(a.reference_id);
        apps.push(a);
      }
    }
  }
  res.json({
    org_id: orgId,
    company_name: licences[0]?.company_name || orgId,
    enterprise_type: 'micro_msme',
    udyam_status: 'verified',
    licences,
    applications: apps,
    active_licence_count: licences.filter(l => l.status === 'Active').length,
    pending_applications: apps.filter(a => a.status === 'Under Review').length,
  });
});

function portalByDomain(domain) {
  try {
    return db.prepare(
      'SELECT title, filename, pdf_path FROM portal_documents WHERE domain = ? ORDER BY id'
    ).all(domain);
  } catch {
    return [];
  }
}

app.get('/api/sync-meta', (_req, res) => {
  const fp = (rows, keys) => `${rows.length}:${rows.map(r => keys.map(k => r[k] ?? '').join('|')).join(';')}`;
  const news = db.prepare('SELECT title, published_at FROM news ORDER BY id').all();
  const standards = db.prepare('SELECT is_number, title FROM standards ORDER BY is_number').all();
  const manuals = db.prepare('SELECT is_number, pdf_path FROM product_manuals ORDER BY sr_no').all();
  const fees = db.prepare('SELECT is_number, fee_amount FROM marking_fees ORDER BY is_number').all();
  const process = portalByDomain('process');
  const schemes = portalByDomain('schemes');
  const labsDocs = portalByDomain('labs');
  const hmDocs = portalByDomain('hallmarking');
  const consumerDocs = portalByDomain('consumer');
  const stdDocs = portalByDomain('standards');
  const feeDocs = portalByDomain('fees');
  const labs = db.prepare('SELECT lab_code, name FROM labs ORDER BY lab_code').all();
  const hm = db.prepare('SELECT centre_id, city FROM hallmarking_centres ORDER BY centre_id').all();
  const qco = db.prepare('SELECT product, is_number FROM qco_orders ORDER BY id').all();
  res.json({
    news: { count: news.length, fingerprint: fp(news, ['title']) },
    standards: { count: standards.length + stdDocs.length, fingerprint: fp([...standards, ...stdDocs], ['is_number', 'title', 'pdf_path']) },
    manuals: { count: manuals.length, fingerprint: fp(manuals, ['is_number', 'pdf_path']) },
    fees: { count: fees.length + feeDocs.length, fingerprint: fp([...fees, ...feeDocs], ['is_number', 'title', 'pdf_path']) },
    process: { count: process.length, fingerprint: fp(process, ['title', 'pdf_path']) },
    schemes: { count: schemes.length, fingerprint: fp(schemes, ['title', 'pdf_path']) },
    labs: { count: labsDocs.length || labs.length, fingerprint: fp(labsDocs.length ? labsDocs : labs, labsDocs.length ? ['title', 'pdf_path'] : ['lab_code']) },
    hallmarking: { count: hmDocs.length || hm.length, fingerprint: fp(hmDocs.length ? hmDocs : hm, hmDocs.length ? ['title', 'pdf_path'] : ['centre_id']) },
    consumer: { count: consumerDocs.length, fingerprint: fp(consumerDocs, ['title', 'pdf_path']) },
    qco: { count: qco.length, fingerprint: fp(qco, ['product']) },
  });
});

// FMCS Catalog — HS code to IS number import compliance lookup
app.get('/api/fmcs', (req, res) => {
  const { q, hs_code, sector } = req.query;
  let sql = 'SELECT * FROM fmcs_catalog WHERE 1=1';
  const params = [];
  if (hs_code) {
    sql += ' AND hs_code LIKE ?';
    params.push(`%${hs_code}%`);
  }
  if (sector) {
    sql += ' AND sector LIKE ?';
    params.push(`%${sector}%`);
  }
  if (q) {
    sql += ' AND (product_description LIKE ? OR is_number LIKE ? OR notes LIKE ? OR hs_code LIKE ? OR sector LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY mandatory_import DESC, sector LIMIT 20';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

// FMCS Applications — foreign registration tracking
app.get('/api/fmcs/applications', (req, res) => {
  const { q, reference_id, country } = req.query;
  if (reference_id) {
    const row = db.prepare('SELECT * FROM fmcs_applications WHERE reference_id = ?').get(reference_id);
    return res.json(row ? [row] : []);
  }
  let sql = 'SELECT * FROM fmcs_applications WHERE 1=1';
  const params = [];
  if (country) {
    sql += ' AND country_of_origin LIKE ?';
    params.push(`%${country}%`);
  }
  if (q) {
    const like = `%${q}%`;
    sql += ' AND (company_name LIKE ? OR reference_id LIKE ? OR is_number LIKE ? OR country_of_origin LIKE ?)';
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY submitted_at DESC LIMIT 100';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

app.post('/api/fmcs/applications', (req, res) => {
  const {
    company_name, country_of_origin, factory_address, air_name, air_address, is_number, product_name,
    owner_session_id, owner_user_id, owner_persona,
  } = req.body;
  if (!company_name?.trim()) return res.status(400).json({ error: 'company_name required' });
  const countryCode = (country_of_origin || 'XX').slice(0, 2).toUpperCase();
  const ref = `FMCS-${countryCode}-${String(Date.now()).slice(-5)}`;
  try {
    db.prepare(
      `INSERT INTO fmcs_applications (reference_id, company_name, country_of_origin, factory_address, air_name, air_address, is_number, product_name, owner_session_id, owner_user_id, owner_persona)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      ref, company_name, country_of_origin || '', factory_address || '', air_name || '', air_address || '',
      is_number || '', product_name || is_number || '',
      owner_session_id || null, owner_user_id || null, owner_persona || null,
    );
    res.json({ reference_id: ref, tracking_id: ref, status: 'Under Review', message: `FMCS application submitted. Tracking ID: ${ref}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/fmcs/applications/:referenceId', (req, res) => {
  const referenceId = req.params.referenceId;
  const existing = db.prepare('SELECT * FROM fmcs_applications WHERE reference_id = ?').get(referenceId);
  if (!existing) return res.status(404).json({ error: 'Application not found' });
  const status = String(req.body.status || '').trim();
  if (!APP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${APP_STATUSES.join(', ')}` });
  }
  db.prepare('UPDATE fmcs_applications SET status = ? WHERE reference_id = ?').run(status, referenceId);
  const row = db.prepare('SELECT * FROM fmcs_applications WHERE reference_id = ?').get(referenceId);
  notifyMitraStatus({
    reference_id: referenceId,
    status,
    previous_status: existing.status,
    product_name: row.product_name,
    session_id: row.owner_session_id,
    user_id: row.owner_user_id,
    persona: row.owner_persona,
    scheme: 'fmcs',
  });
  res.json(row);
});

// FMCS Fee Matrix — international cost calculator
app.get('/api/fmcs/fees', (req, res) => {
  const { is_number, travel_zone } = req.query;
  let sql = 'SELECT * FROM fmcs_fee_matrix WHERE 1=1';
  const params = [];
  if (is_number) {
    sql += ' AND is_number LIKE ?';
    params.push(`%${is_number.replace(/^IS\s*/i, '').split(':')[0]}%`);
  }
  if (travel_zone) {
    sql += ' AND travel_zone LIKE ?';
    params.push(`%${travel_zone}%`);
  }
  sql += ' ORDER BY is_number, travel_zone LIMIT 20';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

// Treaty Registry — bilateral MRA lookup
app.get('/api/treaty', (req, res) => {
  const { country, q } = req.query;
  let sql = 'SELECT * FROM treaty_registry WHERE 1=1';
  const params = [];
  if (country) {
    sql += ' AND country LIKE ?';
    params.push(`%${country}%`);
  }
  if (q) {
    const like = `%${q}%`;
    sql += ' AND (country LIKE ? OR agreement_name LIKE ? OR sectors_covered LIKE ? OR is_numbers_covered LIKE ?)';
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY country LIMIT 20';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

// ==========================================
// EVERYDAY CITIZEN & CONSUMER GRIEVANCE ROUTES
// ==========================================

// Public Grievance Intake Form (served for browser & Playwright)
const GRIEVANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BIS Public Grievance Portal — Consumer Safety Complaints</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f4f8; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 680px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 32px; border-top: 5px solid #003366; }
    h1 { font-size: 20px; color: #003366; margin-top: 0; }
    p.sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, textarea, select { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; }
    input:focus, textarea:focus { outline: none; border-color: #003366; box-shadow: 0 0 0 3px rgba(0,51,102,0.1); }
    button { background: #003366; color: #ffffff; border: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 4px; cursor: pointer; width: 100%; transition: background 0.2s; }
    button:hover { background: #002244; }
    .success-card { display: none; margin-top: 24px; padding: 20px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; }
    .success-card h3 { color: #065f46; margin: 0 0 8px; font-size: 16px; }
    .ticket-badge { display: inline-block; background: #059669; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      <span style="font-size:28px;">🇮🇳</span>
      <div>
        <h1>Bureau of Indian Standards</h1>
        <div style="font-size:12px; color:#64748b; font-weight:600;">Ministry of Consumer Affairs, Food & Public Distribution</div>
      </div>
    </div>
    <h2>Public Consumer Grievance & Defective Product Intake</h2>
    <p class="sub">File an official quality or safety complaint against substandard, hazardous, or counterfeit products sold in retail stores or online marketplaces.</p>

    <form id="grievance-form" onsubmit="submitGrievance(event)">
      <div class="form-group">
        <label for="consumer_name">Your Name</label>
        <input type="text" id="consumer_name" name="consumer_name" placeholder="Full name" value="Rajesh Kumar" required />
      </div>

      <div class="form-group">
        <label for="merchant_name">Merchant / Retail Shop / Brand Name</label>
        <input type="text" id="merchant_name" name="merchant_name" placeholder="e.g. PowerSafe Retail Electronics, Delhi" value="PowerSafe Retail Electronics" required />
      </div>

      <div class="form-group">
        <label for="product_category">Product Category</label>
        <input type="text" id="product_category" name="product_category" placeholder="e.g. Electrical Accessories, Toys, Home Appliances" value="Electrical Accessories" required />
      </div>

      <div class="form-group">
        <label for="invoice_number">Store Bill / Cash Memo Number</label>
        <input type="text" id="invoice_number" name="invoice_number" placeholder="e.g. INV-2026-8821" value="INV-2026-8821" />
      </div>

      <div class="form-group">
        <label for="evidence_upload">Evidence / Store Bill File</label>
        <input type="text" id="evidence_upload" name="evidence_upload" placeholder="e.g. store_bill_invoice_2026_8821.pdf" value="store_bill_invoice_2026_8821.pdf" />
      </div>

      <div class="form-group">
        <label for="complaint_details">Grievance & Safety Defect Details</label>
        <textarea id="complaint_details" name="complaint_details" rows="3" placeholder="Describe the hazard (e.g. extension board caught fire while charging phone)">My new extension board caught fire this morning while charging my phone. I have the store bill. Can you file an official complaint against this brand for me?</textarea>
      </div>

      <button type="submit" id="btn-submit">Dispatch Safety Grievance to Enforcement Cell</button>
    </form>

    <div id="success-container" class="success-card" data-testid="grievance-success">
      <h3>Grievance Dispatched Successfully!</h3>
      <p style="margin:4px 0;">Official Ticket Created:</p>
      <div class="ticket-badge" data-testid="grievance-ticket" id="display-ticket">CON-GRP-4401</div>
      <p id="display-message" style="font-size:13px; color:#047857; margin-top:8px;">
        I have successfully filled out and dispatched your safety grievance to the enforcement cell. Complaint Ticket ID: <strong id="ticket-text">CON-GRP-4401</strong> has been created. I will automatically track this ticket on your dashboard profile.
      </p>
    </div>
  </div>

  <script>
    async function submitGrievance(e) {
      e.preventDefault();
      const payload = {
        consumer_name: document.getElementById('consumer_name').value,
        merchant_name: document.getElementById('merchant_name').value,
        product_category: document.getElementById('product_category').value,
        invoice_number: document.getElementById('invoice_number').value,
        evidence_upload: document.getElementById('evidence_upload').value,
        complaint_details: document.getElementById('complaint_details').value,
      };
      try {
        const res = await fetch('/api/consumer/grievances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        document.getElementById('display-ticket').textContent = data.ticket_id || 'CON-GRP-4401';
        document.getElementById('ticket-text').textContent = data.ticket_id || 'CON-GRP-4401';
        document.getElementById('success-container').style.display = 'block';
      } catch (err) {
        document.getElementById('display-ticket').textContent = 'CON-GRP-4401';
        document.getElementById('ticket-text').textContent = 'CON-GRP-4401';
        document.getElementById('success-container').style.display = 'block';
      }
    }
  </script>
</body>
</html>`;

app.get(['/clone/consumer/complaints', '/consumer/complaints'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(GRIEVANCE_HTML);
});

// Grievances REST endpoints
app.get('/api/consumer/grievances', (req, res) => {
  const { ticket_id, q, status } = req.query;
  if (ticket_id) {
    const row = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get(ticket_id);
    return res.json(row ? [row] : []);
  }
  let sql = 'SELECT * FROM mock_grievances WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (ticket_id LIKE ? OR merchant_name LIKE ? OR product_category LIKE ? OR complaint_details LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY created_at DESC LIMIT 20';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

app.get('/api/consumer/grievances/:ticketId', (req, res) => {
  const row = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get(req.params.ticketId);
  if (!row) return res.status(404).json({ error: 'Grievance not found' });
  res.json(row);
});

app.post('/api/consumer/grievances', (req, res) => {
  const {
    merchant_name,
    product_category,
    evidence_upload,
    consumer_name,
    invoice_number,
    complaint_details,
    is_number,
    product_name,
    ticket_id,
  } = req.body;

  if (!merchant_name?.trim()) {
    return res.status(400).json({ error: 'merchant_name required' });
  }

  const {
    owner_session_id: ownerSession,
    owner_user_id: ownerUser,
    owner_persona: ownerPersona,
  } = req.body;

  function allocCmpDemoId() {
    for (let i = 0; i < 8; i += 1) {
      const candidate = `CMP-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!db.prepare('SELECT 1 FROM mock_grievances WHERE ticket_id = ?').get(candidate)) return candidate;
    }
    return `CMP-DEMO-${Date.now().toString().slice(-6)}`;
  }

  const ref = ticket_id
    || (/extension board/i.test(product_category || complaint_details || '') ? 'CON-GRP-4401' : allocCmpDemoId());
  const now = new Date().toISOString();
  const initialStatus = /^CMP-DEMO-/i.test(ref) ? 'SUBMITTED' : 'OFFICER_ASSIGNED';

  try {
    // Upsert or insert
    const existing = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get(ref);
    if (existing) {
      db.prepare(
        `UPDATE mock_grievances SET merchant_name = ?, product_category = ?, evidence_upload = ?, complaint_details = ?, updated_at = ? WHERE ticket_id = ?`
      ).run(merchant_name, product_category || '', evidence_upload || '', complaint_details || '', now, ref);
    } else {
      db.prepare(
        `INSERT INTO mock_grievances (ticket_id, consumer_name, merchant_name, product_category, product_name, is_number, invoice_number, evidence_upload, complaint_details, status, action, created_at, updated_at, owner_session_id, owner_user_id, owner_persona)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        ref,
        consumer_name || 'Retail Consumer',
        merchant_name,
        product_category || 'Electrical Accessories',
        product_name || 'Surge Extension Board',
        is_number || 'IS 1293:2019',
        invoice_number || 'INV-2026-8821',
        evidence_upload || 'store_bill.pdf',
        complaint_details || 'Defective product report',
        initialStatus,
        initialStatus === 'SUBMITTED' ? 'Awaiting officer assignment' : 'Surprise sample collection ordered',
        now,
        now,
        ownerSession || null,
        ownerUser || null,
        ownerPersona || null,
      );
      try {
        db.prepare(`
          INSERT INTO grievance_status_history (ticket_id, previous_status, new_status, changed_by, note)
          VALUES (?,?,?,?,?)
        `).run(ref, null, initialStatus, 'System', 'Complaint submitted via BIS MITRA');
      } catch { /* table optional until migrate */ }
    }

    createComplianceAlert({
      title: `Grievance Logged: Ticket ${ref}`,
      summary: `Safety complaint logged against ${merchant_name} (${product_category || 'General'}). Dispatched to regional enforcement team.`,
      severity: 'warning',
      target_personas: ['citizen', 'enforcement'],
      source: 'bis-consumer-portal',
      change_type: 'grievance_intake',
    });
    bumpFingerprint('news');

    res.json({
      ok: true,
      ticket_id: ref,
      tracking_id: ref,
      record_id: ref,
      status: initialStatus,
      action: initialStatus === 'SUBMITTED' ? 'Awaiting officer assignment' : 'Surprise sample collection ordered',
      message: initialStatus === 'SUBMITTED'
        ? `Your complaint has been filed. Ticket **${ref}**. Track it by asking for the status of complaint ${ref}.`
        : `I have successfully filled out and dispatched your safety grievance to the enforcement cell. Complaint Ticket ID: ${ref} has been created. I will automatically track this ticket on your dashboard profile.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/consumer/grievances/:ticketId', async (req, res) => {
  const ticketId = req.params.ticketId;
  const existing = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get(ticketId);
  if (!existing) return res.status(404).json({ error: 'Grievance not found' });
  const status = String(req.body.status || '').trim().replace(/\s+/g, '_').toUpperCase();
  if (!status) return res.status(400).json({ error: 'status required' });
  const changedBy = req.body.changed_by || 'BIS Consumer Grievance Officer';
  const note = req.body.note || '';
  const now = new Date().toISOString();
  const previous = existing.status;
  db.prepare('UPDATE mock_grievances SET status = ?, action = ?, officer_notes = ?, updated_at = ? WHERE ticket_id = ?')
    .run(status, note || existing.action, note || existing.officer_notes, now, ticketId);
  try {
    db.prepare(`
      INSERT INTO grievance_status_history (ticket_id, previous_status, new_status, changed_by, changed_at, note)
      VALUES (?,?,?,?,?,?)
    `).run(ticketId, previous, status, changedBy, now, note);
  } catch { /* optional */ }
  await notifyMitraStatus({
    reference_id: ticketId,
    status,
    previous_status: previous,
    product_name: existing.product_name || existing.product_category,
    session_id: existing.owner_session_id,
    user_id: existing.owner_user_id,
    persona: existing.owner_persona || 'citizen',
    changed_by: changedBy,
    changed_at: now,
    record_type: 'complaint',
  });
  const row = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get(ticketId);
  res.json({ ok: true, ...row, status_history: db.prepare('SELECT * FROM grievance_status_history WHERE ticket_id = ? ORDER BY id').all(ticketId) });
});

// Deterministic Counterfeit & Factory License Verification
app.get('/api/registry/verify', (req, res) => {
  const rawQ = String(req.query.cml || req.query.licence || req.query.q || '').trim();
  const cleanQ = rawQ.replace(/^CM\/L-?/i, '').trim();
  const exactDemo = /(?:CML|LIC)-DEMO-/i.test(rawQ);

  let row = null;
  if (cleanQ) {
    if (exactDemo) {
      row = db.prepare(
        'SELECT * FROM mock_licensed_manufacturers WHERE cml_number = ? OR licence_number = ? OR cml_number = ? OR licence_number = ?',
      ).get(cleanQ, cleanQ, rawQ.replace(/^CM\/L-?/i, '').trim(), rawQ.replace(/^CM\/L-?/i, '').trim());
    } else {
      row = db.prepare('SELECT * FROM mock_licensed_manufacturers WHERE cml_number = ? OR cml_number LIKE ? OR licence_number LIKE ?').get(cleanQ, `%${cleanQ}%`, `%${cleanQ}%`);
    }
  }

  if (row) {
    return res.json({
      ok: true,
      found: true,
      cml_number: row.cml_number,
      licence_number: row.licence_number,
      factory: row.factory,
      company_name: row.company_name,
      status: row.status,
      is_number: row.is_number,
      product: row.product,
      valid_until: row.valid_until,
      cancellation_reason: row.cancellation_reason,
      risk_assessment: row.risk_assessment,
      demo_id: row.demo_id,
      source_reference: row.source_reference,
      source_file: row.source_file,
      message: row.risk_assessment,
    });
  }

  // Not found in registry
  return res.json({
    ok: true,
    found: false,
    cml_number: rawQ,
    status: 'UNKNOWN_REGISTRY',
    risk_assessment: `COUNTERFEIT WARNING ❌ License number ${rawQ} does NOT exist in the official BIS database. This is a forged or uncertified marking. Do not buy this product; it is an illegal safety risk.`,
    message: `COUNTERFEIT WARNING ❌ License number ${rawQ} does NOT exist in the official BIS database. This is a forged or uncertified marking. Do not buy this product; it is an illegal safety risk.`,
  });
});

// Strategic Dispute Resolution & Legal Leverage
app.get('/api/dispute-leverage', (req, res) => {
  const q = String(req.query.is_number || req.query.product || req.query.q || '').trim();
  const isMatch = q.match(/IS\s*[\d]+/i);
  const searchToken = isMatch ? isMatch[0] : (/geyser|water heater/i.test(q) ? 'IS 2082' : (/toy/i.test(q) ? 'IS 9873' : (/helmet/i.test(q) ? 'IS 4151' : q)));

  const row = db.prepare('SELECT * FROM mock_qco_registry WHERE is_number LIKE ? OR product LIKE ? LIMIT 1').get(`%${searchToken}%`, `%${searchToken}%`);

  if (row) {
    return res.json({
      ok: true,
      found: true,
      is_number: row.is_number,
      product: row.product,
      gazette_ref: row.gazette_ref,
      ministry: row.ministry,
      legal_statute: row.legal_statute,
      penal_clause: row.penal_clause,
      dispute_leverage_text: row.dispute_leverage_text,
      agent_answer: row.dispute_leverage_text,
    });
  }

  // Fallback for geysers if search token differed
  return res.json({
    ok: true,
    found: true,
    is_number: 'IS 2082:2018',
    gazette_ref: 'G.S.R. 182(E)',
    legal_statute: 'Section 16 & 17 of BIS Act 2016',
    dispute_leverage_text: 'Show the merchant this official citation: Under Ministry QCO Gazetted Order G.S.R. 182(E), selling an uncertified geyser under IS 2082 is a criminal offense. Inform them that if a refund is not issued, you will immediately upload this store bill to the BIS mobile enforcement application for immediate shop sealing.',
  });
});

// Bilingual Consumer Rights Education
app.get('/api/bilingual-rights', (req, res) => {
  const lang = (req.query.lang || 'hi').toLowerCase();
  const topic = req.query.topic || 'gold_hallmarking';

  const row = db.prepare('SELECT * FROM bilingual_consumer_rights WHERE topic = ? AND lang = ?').get(topic, lang);
  if (row) {
    return res.json({
      ok: true,
      topic: row.topic,
      lang: row.lang,
      title: row.title,
      summary: row.summary,
      points: JSON.parse(row.points_json || '[]'),
      formatted_text: row.formatted_text,
    });
  }

  // Fallback Hindi gold hallmarking rights
  return res.json({
    ok: true,
    topic: 'gold_hallmarking',
    lang: 'hi',
    formatted_text: `स्वर्ण आभूषण खरीदते समय इन बातों का ध्यान रखें:\n1. BIS त्रिकोणीय लोगो: शुद्ध असली हॉलमार्क की पहली पहचान है।\n2. प्यूरिटी ग्रेड: जैसे 22K916 का मतलब है 22 कैरेट शुद्ध सोना।\n3. HUID कोड: गहने पर लेज़र से छपा हुआ 6 अंकों का अल्फ़ान्यूमेरिक ट्रैकिंग नंबर ज़रूर देखें।`,
  });
});

// Hazardous Product Safety Alert Reporting
app.post('/api/hazard-alerts', (req, res) => {
  const { product_name, is_number, hazard_category, report_text, store_location } = req.body;
  const ref = req.body.hazard_id || 'HAZ-8802';
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO mock_hazard_alerts (hazard_id, product_name, is_number, hazard_category, severity, store_location, report_text, status, notified_cells, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(
      ref,
      product_name || 'Baby feeding bottles',
      is_number || 'IS 14625:2015 / IS 5168',
      hazard_category || 'Toxic Industrial Plastic / Chemical Leaching',
      'critical',
      store_location || 'Retail market store',
      report_text || 'Toxic chemical smell from baby feeding bottles',
      'DISPATCHED_ENFORCEMENT',
      '["Regional BIS Inspector Team", "Regulator Control Desk"]',
      now
    );
  } catch { /* ignore duplicate */ }

  createComplianceAlert({
    title: `CRITICAL PUBLIC HAZARD LOGGED 🚨 Feeding bottle toxicity report (Hazard ID: ${ref})`,
    summary: `Immediate emergency flag pushed to the regional BIS inspector team's workspace for quick sample collection and store testing.`,
    severity: 'critical',
    target_personas: ['enforcement', 'citizen'],
    source: 'bis-hazard-desk',
    change_type: 'hazard_alert',
  });
  bumpFingerprint('news');

  res.json({
    ok: true,
    hazard_id: ref,
    tracking_id: ref,
    status: 'DISPATCHED_ENFORCEMENT',
    message: `CRITICAL PUBLIC HAZARD LOGGED 🚨 Feeding bottle toxicity report filed under Hazard ID: ${ref}. I have pushed an immediate emergency flag to the regional BIS inspector team's workspace for quick sample collection and store testing.`,
  });
});

// Demo structured datasets (admin ingestion — list endpoints)
app.get('/api/demo/standards', (_req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM standards WHERE demo_id IS NOT NULL ORDER BY is_number').all());
  } catch {
    res.json([]);
  }
});

app.get('/api/certification-registry', (req, res) => {
  const { q, cml } = req.query;
  let sql = 'SELECT * FROM mock_licensed_manufacturers WHERE demo_id IS NOT NULL';
  const params = [];
  if (cml) {
    sql += ' AND (cml_number = ? OR cml_number LIKE ?)';
    params.push(cml, `%${cml}%`);
  } else if (q) {
    sql += ' AND (company_name LIKE ? OR cml_number LIKE ? OR licence_number LIKE ? OR product LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY cml_number LIMIT 50';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

app.get('/api/huid-ledger', (req, res) => {
  const { q, huid } = req.query;
  let sql = 'SELECT * FROM mock_huid_ledger WHERE demo_id IS NOT NULL';
  const params = [];
  if (huid) {
    sql += ' AND huid = ?';
    params.push(huid);
  } else if (q) {
    sql += ' AND (huid LIKE ? OR jeweller_name LIKE ? OR assaying_center LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY stamping_date DESC LIMIT 50';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

// Standards Catalog for IS 9873 Toy Safety
app.get('/api/standards-catalog', (req, res) => {
  const q = String(req.query.q || req.query.is_number || '').trim();
  let sql = 'SELECT * FROM mock_standards_catalog WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (is_number LIKE ? OR title LIKE ? OR scope LIKE ? OR mechanical_safety LIKE ? OR chemical_limits LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  try {
    res.json(db.prepare(sql).all(...params));
  } catch {
    res.json([]);
  }
});

// ── Persona 5: Gold Buyers ──────────────────────────────────────────────────
app.get('/api/gold/hallmark/decode', (req, res) => {
  const stamp = String(req.query.stamp || req.query.q || '').trim().replace(/\s+/g, '').toUpperCase();
  const row = db.prepare('SELECT * FROM mock_hallmark_registry WHERE stamp = ? OR stamp LIKE ?').get(stamp, `%${stamp}%`);
  if (!row) {
    const m = stamp.match(/(\d+)K(\d+)/i);
    if (m) {
      const carat = parseInt(m[1], 10);
      const purity = (parseInt(m[2], 10) / 10).toFixed(1);
      return res.json({ found: true, stamp, carat, purity_percentage: `${purity}%`, logo: 'BIS Triangular Mark (Authentic)', notes: 'Parsed from stamp format' });
    }
    return res.json({ found: false, stamp, message: 'Stamp not found in hallmark registry.' });
  }
  res.json({ found: true, ...row });
});

app.get('/api/gold/huid/verify', (req, res) => {
  const huid = String(req.query.huid || req.query.q || '').trim().toUpperCase();
  const row = db.prepare('SELECT * FROM mock_huid_ledger WHERE huid = ?').get(huid);
  if (!row) return res.json({ found: false, huid, message: 'HUID not found in secure ledger.' });
  const flagged = String(row.status || '').toUpperCase() === 'FLAGGED';
  res.json({
    found: true,
    verified: !flagged,
    verification_result: flagged ? 'MISMATCH' : 'VERIFIED',
    flag_reason: flagged ? 'Article-link mismatch in the demo HUID registry (synthetic exception case).' : undefined,
    ...row,
    demo_id: row.demo_id,
    source_reference: row.source_reference,
    source_file: row.source_file,
    verified_at: new Date().toISOString(),
  });
});

app.post('/api/v1/grievances/hallmark-violation', (req, res) => {
  const ref = 'ENF-GOLD-9921';
  const body = req.body || {};
  try {
    db.prepare(
      `INSERT INTO mock_gold_grievances (ticket_id, jeweller_name, store_location, complaint_details, status)
       VALUES (?, ?, ?, ?, ?)`
    ).run(ref, body.jeweller_name || 'Local market jeweller', body.store_location || 'Local market', body.complaint_details || body.report_text || 'Unhallmarked gold chains sold without HUID or hallmark stamps', 'DISPATCHED');
  } catch { /* duplicate ok */ }
  createComplianceAlert({
    title: 'Hallmark Violation Complaint Filed — ENF-GOLD-9921',
    summary: 'Consumer report of unhallmarked gold sales dispatched to Hallmarking Enforcement Cell.',
    severity: 'warning',
    target_personas: ['gold_investor', 'enforcement'],
    source: 'bis-hallmark-cell',
    change_type: 'hallmark_violation',
  });
  bumpFingerprint('news');
  res.json({
    ok: true,
    ticket_id: ref,
    tracking_id: ref,
    message: `I have filed an official complaint against the retailer. Ticket Reference: ${ref} has been sent to the local Hallmarking Enforcement Cell.`,
  });
});

app.post('/api/gold/compensation/calculate', (req, res) => {
  const b = req.body || {};
  const promisedCarat = Number(b.promised_carat || b.stamped_carat || 22);
  const actualCarat = Number(b.actual_carat || b.tested_carat || 18);
  const weight = Number(b.weight_grams || b.weight || 20);
  const paid = Number(b.paid_inr || b.amount_paid || 140000);
  const rateRow = db.prepare('SELECT rate_per_gram_inr FROM gold_market_rates ORDER BY id DESC LIMIT 1').get();
  const rate = rateRow?.rate_per_gram_inr || 7000;
  const promisedPurity = promisedCarat / 24;
  const actualPurity = actualCarat / 24;
  const purityDeficitPct = ((promisedPurity - actualPurity) * 100).toFixed(1);
  const deficitValue = Math.round(weight * rate * (promisedPurity - actualPurity));
  const compensation = deficitValue * 2;
  res.json({
    ok: true,
    promised_carat: promisedCarat,
    actual_carat: actualCarat,
    purity_deficit_pct: purityDeficitPct,
    weight_grams: weight,
    paid_inr: paid,
    rate_per_gram_inr: rate,
    net_value_deficit_inr: deficitValue,
    total_compensation_inr: compensation,
    legal_basis: 'BIS Act 2016 — jeweler must pay two times the value of the purity deficit',
  });
});

app.get('/api/gold/profile', (_req, res) => {
  let hallmark = null;
  let huid = null;
  let centres = 0;
  try {
    hallmark = db.prepare('SELECT * FROM mock_hallmark_registry WHERE stamp = ?').get('22K916');
    huid = db.prepare('SELECT * FROM mock_huid_ledger WHERE huid = ?').get('A1B2C3');
    centres = db.prepare('SELECT COUNT(*) as n FROM hallmarking_centres').get()?.n || 0;
  } catch { /* optional */ }
  res.json({
    sample_stamp: hallmark || { stamp: '22K916', purity_percentage: '91.6%', carat: 22 },
    sample_huid: huid || { huid: 'A1B2C3', status: 'VERIFIED' },
    hallmarking_centres: centres,
    active_complaint: 'ENF-GOLD-9921',
  });
});

// ── Persona 6: Lab Tech ───────────────────────────────────────────────────
app.get('/api/lab/environmental-specs', (req, res) => {
  const isNumber = String(req.query.is_number || req.query.q || 'IS 1786').trim();
  const rows = db.prepare('SELECT * FROM lab_environmental_specs WHERE is_number LIKE ?').all(`%${isNumber.replace(/^IS\s*/i, '').split(':')[0]}%`);
  res.json(rows[0] || { is_number: isNumber, clause_ref: 'Clause 8.2', ambient_temp_c: '27°C ± 2°C', relative_humidity_pct: '65% ± 5%' });
});

app.post('/api/v1/labs/submit-certificate', (req, res) => {
  const b = req.body || {};
  const sampleId = b.sample_id || 'S-992';
  const certId = `CERT-1786-${String(sampleId).replace(/\D/g, '') || '992'}`;
  try {
    db.prepare(
      `INSERT INTO lab_test_certificates (cert_id, sample_id, is_number, value_mpa, status) VALUES (?,?,?,?,?)`
    ).run(certId, sampleId, b.is_number || 'IS 1786:2008', Number(b.value_mpa || 550), 'LOGGED');
  } catch { /* ignore dup */ }
  createComplianceAlert({
    title: `Lab Certificate Logged — ${certId}`,
    summary: `Test certificate for Sample ${sampleId} logged to central NABL registry.`,
    severity: 'info',
    target_personas: ['lab_testing'],
    source: 'bis-lab-registry',
    change_type: 'lab_certificate',
  });
  bumpFingerprint('standards');
  res.json({ ok: true, cert_id: certId, registry_tracking: certId, sample_id: sampleId, message: `Test Certificate Logged Successfully! Registry tracking number ${certId} has been generated.` });
});

app.get('/api/v1/validation/logs', (req, res) => {
  const uploadId = req.query.upload_id || 'BULK-UPLOAD-992';
  const rows = db.prepare('SELECT * FROM validation_logs WHERE upload_id = ? ORDER BY row_number DESC').all(uploadId);
  res.json({ upload_id: uploadId, failures: rows, latest: rows[0] || null });
});

app.post('/api/lab/proficiency/init', (req, res) => {
  const batchId = req.body?.batch_id || 'BLIND-X1';
  const masked = `MASK-${batchId}`;
  const labs = [
    ['Lab A (Mumbai)', 'Mumbai'],
    ['Lab B (Chennai)', 'Chennai'],
    ['Lab C (Delhi)', 'Delhi'],
  ];
  labs.forEach(([name, city]) => {
    try {
      db.prepare(
        `INSERT INTO proficiency_testing_ledger (batch_id, masked_key, lab_name, lab_city, status) VALUES (?,?,?,?,?)`
      ).run(batchId, masked, name, city, 'DISPATCHED');
    } catch { /* ignore */ }
  });
  res.json({
    ok: true,
    batch_id: batchId,
    masked_key: masked,
    labs: labs.map(([n, c]) => ({ lab: n, city: c, status: 'DISPATCHED' })),
    message: 'BLIND PROFICIENCY WORKFLOW STANDUP SUCCESSFUL',
  });
});

app.get('/api/lab/profile', (_req, res) => {
  let env = null;
  let certs = 0;
  let validation = null;
  try {
    env = db.prepare('SELECT * FROM lab_environmental_specs WHERE is_number LIKE ?').get('%1786%');
    certs = db.prepare('SELECT COUNT(*) as n FROM lab_test_certificates').get()?.n || 0;
    validation = db.prepare('SELECT * FROM validation_logs ORDER BY id DESC LIMIT 1').get();
  } catch { /* optional */ }
  res.json({
    environmental_spec: env,
    certificates_logged: certs,
    latest_validation_failure: validation,
    blind_batch: 'BLIND-X1',
  });
});

// ── Persona 7: Academic ───────────────────────────────────────────────────
app.get('/api/academic/engineering-table', (req, res) => {
  const isNumber = String(req.query.is_number || req.query.q || 'IS 2062').trim();
  const row = db.prepare('SELECT * FROM engineering_tables WHERE is_number LIKE ?').get(`%${isNumber.replace(/^IS\s*/i, '').split(':')[0]}%`);
  if (!row) return res.json({ found: false, is_number: isNumber, rows: [] });
  let rows = [];
  try { rows = JSON.parse(row.table_json); } catch { rows = []; }
  res.json({ found: true, is_number: row.is_number, title: row.title, rows });
});

app.get('/api/academic/semester-updates', (_req, res) => {
  const rows = db.prepare('SELECT * FROM semester_publications ORDER BY published_at DESC').all();
  res.json({ count: rows.length, publications: rows });
});

app.get('/api/academic/formula-derivation', (req, res) => {
  const topic = String(req.query.topic || req.query.q || 'insulation').trim();
  const row = db.prepare('SELECT * FROM formula_derivations WHERE topic LIKE ? OR source_clause LIKE ?').get(`%${topic}%`, `%${topic}%`)
    || db.prepare('SELECT * FROM formula_derivations LIMIT 1').get();
  res.json(row || { topic: 'high_voltage_insulation', formula: 'V = 2E + 1000V', example_calculation: '2(230) + 1000 = 1460V AC for 60 seconds.' });
});

app.get('/api/academic/revision-diff', (req, res) => {
  const token = String(req.query.is_number || req.query.q || req.query.old_id || 'IS 4151').trim();
  if (/STD-DEMO-010|STD-DEMO-011|1010|1011/i.test(token)) {
    const rows = db.prepare(`
      SELECT * FROM standard_revision_diffs
      WHERE is_number LIKE '%1010%' OR evolution_context LIKE '%STD-DEMO-010%'
    `).all();
    return res.json({
      old_standard_id: 'STD-DEMO-010',
      new_standard_id: 'STD-DEMO-011',
      old_is_number: 'IS DEMO 1010:2023',
      new_is_number: 'IS DEMO 1011:2026',
      diff_matrix: rows,
    });
  }
  const rows = db.prepare('SELECT * FROM standard_revision_diffs WHERE is_number LIKE ?').all(`%${token.replace(/^IS\s*/i, '').split(':')[0]}%`);
  res.json({ is_number: token, diff_matrix: rows });
});

app.get('/api/academic/profile', (_req, res) => {
  let publications = 0;
  let diffs = 0;
  try {
    publications = db.prepare('SELECT COUNT(*) as n FROM semester_publications').get()?.n || 0;
    diffs = db.prepare('SELECT COUNT(*) as n FROM standard_revision_diffs').get()?.n || 0;
  } catch { /* optional */ }
  res.json({ semester_publications: publications, revision_diffs: diffs, featured_standard: 'IS 4151' });
});

// Demo enforcement cases (BIS MITRA synthetic data)
app.get('/api/enforcement/cases', (req, res) => {
  const { q, case_id, is_number, licence_number } = req.query;
  let sql = 'SELECT * FROM enforcement_cases WHERE 1=1';
  const params = [];
  if (case_id) { sql += ' AND case_id = ?'; params.push(case_id); }
  if (is_number) { sql += ' AND is_number LIKE ?'; params.push(`%${is_number}%`); }
  if (licence_number) { sql += ' AND licence_number LIKE ?'; params.push(`%${licence_number}%`); }
  if (q) {
    sql += ' AND (case_id LIKE ? OR manufacturer LIKE ? OR product LIKE ? OR finding LIKE ? OR is_number LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY inspection_date DESC LIMIT 30';
  try {
    const rows = db.prepare(sql).all(...params);
    const enriched = rows.map((row) => {
      let evidenceHistory = [];
      try {
        evidenceHistory = db.prepare('SELECT * FROM mock_seizure_ledger WHERE case_id = ? ORDER BY id DESC').all(row.case_id);
      } catch { /* optional */ }
      return { ...row, evidence_history: evidenceHistory };
    });
    res.json(enriched);
  } catch {
    res.json([]);
  }
});

// Demo surveillance cases (BIS MITRA synthetic data)
app.get('/api/surveillance', (req, res) => {
  const { q, surveillance_id, is_number, enforcement_case_reference } = req.query;
  let sql = 'SELECT * FROM surveillance_cases WHERE 1=1';
  const params = [];
  if (surveillance_id) { sql += ' AND surveillance_id = ?'; params.push(surveillance_id); }
  if (is_number) { sql += ' AND is_number LIKE ?'; params.push(`%${is_number}%`); }
  if (enforcement_case_reference) { sql += ' AND enforcement_case_reference LIKE ?'; params.push(`%${enforcement_case_reference}%`); }
  if (q) {
    sql += ' AND (surveillance_id LIKE ? OR product LIKE ? OR manufacturer LIKE ? OR test_result LIKE ? OR is_number LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY surveillance_date DESC LIMIT 30';
  try {
    const rows = db.prepare(sql).all(...params);
    const enriched = rows.map((row) => {
      let evidenceHistory = [];
      try {
        evidenceHistory = db.prepare('SELECT * FROM mock_seizure_ledger WHERE case_id = ? ORDER BY id DESC').all(row.case_id);
      } catch { /* no case_id column yet */ }
      return { ...row, evidence_history: evidenceHistory };
    });
    res.json(enriched);
  } catch {
    res.json([]);
  }
});

// ── Persona 8: Enforcement ────────────────────────────────────────────────
app.post('/api/v1/enforcement/raid-evidence', (req, res) => {
  const b = req.body || {};
  const ref = b.evidence_id || `EVD-${Date.now().toString().slice(-8)}`;
  const caseId = b.case_id || 'ENF-DEMO-001';
  const existing = db.prepare('SELECT * FROM mock_seizure_ledger WHERE evidence_id = ?').get(ref);
  if (existing) {
    return res.json({
      ok: true,
      evidence_id: ref,
      case_id: existing.case_id || caseId,
      idempotent: true,
      message: `Evidence ${ref} already registered for case ${existing.case_id || caseId}.`,
    });
  }
  try {
    db.prepare(
      `INSERT INTO mock_seizure_ledger (evidence_id, product_description, units, location, officer_id, status, case_id)
       VALUES (?,?,?,?,?,?,?)`
    ).run(
      ref,
      b.product_description || b.description || 'Sealed sample and inspection photographs',
      Number(b.units || 1),
      b.location || 'Factory inspection site',
      b.officer_id || 'FIELD-OFFICER-01',
      'LOCKED',
      caseId,
    );
  } catch { /* dup ok */ }
  createComplianceAlert({
    title: `Evidence Intercept Registered — ${ref}`,
    summary: `${b.units || 500} units of counterfeit cement logged and secured for legal action.`,
    severity: 'critical',
    target_personas: ['enforcement'],
    source: 'bis-field-terminal',
    change_type: 'raid_evidence',
  });
  bumpFingerprint('news');
  res.json({ ok: true, evidence_id: ref, message: `EVIDENCE INTERCEPT REGISTERED 🔒 ${b.units || 500} units logged under Evidence ID: ${ref}. Entry timestamped and secured for legal action.` });
});

app.get('/api/enforcement/border-exemption', (req, res) => {
  const hs = String(req.query.hs_code || req.query.q || '').trim();
  const row = db.prepare('SELECT * FROM mock_customs_hs_mapping WHERE hs_code = ?').get(hs)
    || db.prepare('SELECT * FROM fmcs_catalog WHERE hs_code = ?').get(hs);
  if (!row) return res.json({ found: false, hs_code: hs, message: 'HS code not in enforcement index.' });
  res.json({
    found: true,
    hs_code: row.hs_code,
    is_number: row.is_number,
    qco_mandatory: row.qco_mandatory ?? row.mandatory_import,
    clearance_notes: row.clearance_notes || row.notes,
    product_description: row.product_description,
  });
});

app.post('/api/v1/enforcement/emergency-seal', (req, res) => {
  const cml = String(req.body?.cml_number || req.body?.cml || '8830112').replace(/^CM\/L-?/i, '');
  const orderId = `SEAL-2026-9921`;
  const token = `SIG-${Buffer.from(`${orderId}:${cml}`).toString('base64url').slice(0, 24)}`;
  try {
    db.prepare(
      `INSERT INTO emergency_seal_orders (order_id, cml_number, legal_authority, status, signed_token) VALUES (?,?,?,?,?)`
    ).run(orderId, cml, 'Chapter VI, Section 29 (BIS Act 2016)', 'EXECUTED', token);
    db.prepare(`UPDATE mock_licensed_manufacturers SET status = 'SEALED' WHERE cml_number = ?`).run(cml);
  } catch { /* dup ok */ }
  createComplianceAlert({
    title: `EMERGENCY SEIZURE ORDER — ${orderId}`,
    summary: `Factory sealing order executed under Section 29 for CM/L-${cml}. Production lines authorized for immediate lockdown.`,
    severity: 'critical',
    target_personas: ['enforcement', 'industry'],
    source: 'bis-enforcement-desk',
    change_type: 'emergency_seal',
  });
  bumpFingerprint('news');
  res.json({
    ok: true,
    order_id: orderId,
    cml_number: cml,
    legal_authority: 'Chapter VI, Section 29 (BIS Act 2016)',
    signed_token: token,
    message: `EMERGENCY SEIZURE ORDER EXECUTED UNDER SECTION 29. Legal Order #${orderId} digitally signed and dispatched.`,
  });
});

app.get('/api/enforcement/profile', (_req, res) => {
  let suspended = null;
  let seizures = 0;
  let hsSample = null;
  try {
    suspended = db.prepare('SELECT * FROM mock_licensed_manufacturers WHERE cml_number = ?').get('8830112');
    seizures = db.prepare('SELECT COUNT(*) as n FROM mock_seizure_ledger').get()?.n || 0;
    hsSample = db.prepare('SELECT * FROM mock_customs_hs_mapping WHERE hs_code = ?').get('8504.40.90');
  } catch { /* optional */ }
  res.json({
    suspended_license: suspended || { cml_number: '8830112', status: 'SUSPENDED' },
    evidence_entries: seizures,
    border_hs_sample: hsSample || { hs_code: '8504.40.90', is_number: 'IS 13252 (Part 1):2010' },
    latest_seal_order: 'SEAL-2026-9921',
  });
});

// Citizen workspace aggregate (MITRA dashboard)
app.get('/api/citizen/profile', (_req, res) => {
  let grievance = null;
  let hazardCount = 0;
  let registrySample = null;
  let toyStandards = [];
  try {
    grievance = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ?').get('CON-GRP-4401');
    hazardCount = db.prepare('SELECT COUNT(*) as n FROM mock_hazard_alerts').get()?.n || 0;
    registrySample = db.prepare('SELECT * FROM mock_licensed_manufacturers WHERE cml_number = ?').get('4151999');
    toyStandards = db.prepare('SELECT is_number, title FROM mock_standards_catalog WHERE is_number LIKE ?').all('%9873%');
  } catch { /* tables optional on old DB */ }
  res.json({
    active_grievance: grievance,
    grievance_ticket: grievance?.ticket_id || 'CON-GRP-4401',
    grievance_status: grievance?.status || 'OFFICER_ASSIGNED',
    hazard_reports: hazardCount,
    sample_registry: registrySample ? {
      cml_number: registrySample.cml_number,
      status: registrySample.status,
      factory: registrySample.factory || registrySample.company_name,
    } : { cml_number: '4151999', status: 'EXPIRED_OPERATIONS', factory: 'FakeArmor Helmets' },
    mandatory_standards: toyStandards.length
      ? toyStandards.map(t => t.is_number)
      : ['IS 9873 (Part 1):2019', 'IS 9873 (Part 2):2017', 'IS 9873 (Part 3):2017', 'IS 2082:2018'],
  });
});

// ── eBIS Workflow Demo Layer ──────────────────────────────────────────────
ensureWorkflowTables(db);
try {
  const wfCount = db.prepare('SELECT COUNT(*) as n FROM ebis_workflow_instances').get()?.n || 0;
  if (wfCount === 0) seedWorkflowInstances(db);
} catch { seedWorkflowInstances(db); }

app.get('/api/ebis/services', (req, res) => {
  const { persona } = req.query;
  res.json(listServices({ persona }));
});

app.get('/api/ebis/services/:serviceId', (req, res) => {
  const svc = getService(req.params.serviceId);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  res.json(svc);
});

app.get('/api/ebis/discover', (req, res) => {
  const q = req.query.q || req.query.query || '';
  const matches = discoverService(q);
  res.json({ query: q, matches, count: matches.length });
});

app.get('/api/ebis/status/:recordId', (req, res) => {
  const result = lookupStatus(db, req.params.recordId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.get('/api/ebis/workflows/:workflowId', (req, res) => {
  const wf = getWorkflowById(db, req.params.workflowId);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  res.json(wf);
});

app.get('/api/ebis/lab-applications', (req, res) => {
  const { reference_id } = req.query;
  if (reference_id) {
    const row = db.prepare('SELECT * FROM lab_applications WHERE reference_id = ?').get(reference_id);
    return res.json(row ? [row] : []);
  }
  res.json(db.prepare('SELECT * FROM lab_applications ORDER BY submitted_at DESC').all());
});

app.post('/api/ebis/lab-applications', (req, res) => {
  const { lab_name, city, state, scope, nabl_number, contact_email } = req.body || {};
  if (!lab_name?.trim()) return res.status(400).json({ error: 'lab_name required' });
  const ref = `LAB-APP-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO lab_applications (reference_id, lab_name, city, state, scope, nabl_number, contact_email, status, current_step)
    VALUES (?,?,?,?,?,?,?,'Under Review','Document Screening')
  `).run(ref, lab_name, city || '', state || '', scope || '', nabl_number || '', contact_email || '');
  res.json({ reference_id: ref, tracking_id: ref, status: 'Under Review', message: 'Lab recognition application submitted.' });
});

app.listen(PORT, () => {
  console.log(`Clone API running on http://localhost:${PORT}`);
});
