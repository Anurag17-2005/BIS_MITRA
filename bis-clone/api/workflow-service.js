import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

let servicesCache = null;
let formsCache = null;

function loadServices() {
  if (!servicesCache) {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'ebis-workflow-services.json'), 'utf8');
    servicesCache = JSON.parse(raw);
  }
  return servicesCache;
}

function loadForms() {
  if (!formsCache) {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'ebis-form-schemas.json'), 'utf8');
    formsCache = JSON.parse(raw);
  }
  return formsCache;
}

/** Status lifecycle → next action mapping */
const NEXT_ACTION_MAP = {
  'Submitted': 'BIS will begin document verification.',
  'Under Review': 'Await document verification by BIS certification officer.',
  'Query Raised': 'Respond to the query and upload requested documents via eBIS portal.',
  'Granted': 'Download licence certificate and begin ISI marking as per scheme requirements.',
  'Submitted': 'Track application status; BIS will assign a processing officer.',
  'INSPECTION_SCHEDULED': 'Retain product sample; inspection officer will visit on scheduled date.',
  'Inspection Scheduled': 'Retain product sample; inspection officer will visit on scheduled date.',
  'INVESTIGATION': 'Cooperate with investigation; additional evidence may be requested.',
  'Investigation': 'Cooperate with investigation; additional evidence may be requested.',
  'ASSIGNED': 'Officer assigned; await contact for sample collection or site visit.',
  'Assigned': 'Officer assigned; await contact for sample collection or site visit.',
  'UNDER_REVIEW': 'Documentary verification in progress.',
  'Under Review': 'Documentary verification in progress.',
  'RESOLVED': 'Review resolution details; no further action required unless appealed.',
  'Resolved': 'Review resolution details; no further action required unless appealed.',
  'CLOSED': 'Case closed. Retain acknowledgement for records.',
  'Closed': 'Case closed. Retain acknowledgement for records.',
  'OFFICER_ASSIGNED': 'Field officer assigned; sample collection scheduled within 48 hours.',
  'Documents Required': 'Upload missing documents listed in the query notice.',
  'Inspection/Testing': 'Factory inspection or sample testing in progress.',
  'Testing': 'Product testing is in progress.',
  'Certified': 'Certification approved. Download the certificate from eBIS.',
  'Active': 'Licence is valid. Plan renewal before validity date.',
  'Active - Renewed': 'Licence renewed and valid. Continue compliance monitoring.',
  'Recognised': 'Laboratory recognition granted. Scope available in recognition letter.',
};

export function ensureWorkflowTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ebis_workflow_instances (
      workflow_id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      persona TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      application_id TEXT,
      applicant_name TEXT,
      submitted_at TEXT,
      current_status TEXT NOT NULL,
      current_step TEXT,
      next_action TEXT,
      status_history TEXT,
      assigned_department TEXT,
      related_standard TEXT,
      related_licence TEXT,
      related_cml TEXT,
      evidence_refs TEXT,
      source TEXT,
      demo_id TEXT,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lab_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_id TEXT UNIQUE NOT NULL,
      lab_name TEXT,
      lab_code TEXT,
      city TEXT,
      state TEXT,
      scope TEXT,
      nabl_number TEXT,
      contact_email TEXT,
      status TEXT DEFAULT 'Under Review',
      current_step TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      demo_id TEXT,
      source_reference TEXT,
      source_file TEXT
    );
  `);
}

export function seedWorkflowInstances(db) {
  ensureWorkflowTables(db);

  const instances = [
    {
      workflow_id: 'WF-CERT-DEMO-001',
      service_id: 'SVC-CERT-001',
      persona: 'industry',
      record_type: 'application',
      record_id: 'BIS-APP-CERT-DEMO-001',
      application_id: 'BIS-APP-CERT-DEMO-001',
      applicant_name: 'NovaShield Helmets Pvt. Ltd. (Synthetic)',
      submitted_at: '2026-09-20T10:30:00Z',
      current_status: 'Under Review',
      current_step: 'Document Verification',
      next_action: 'BIS officer reviewing Form-I and NABL test report TRL-DEMO-PPE-26099.',
      status_history: [
        { status: 'Submitted', at: '2026-09-20T10:30:00Z', note: 'Form-I submitted online' },
        { status: 'Under Review', at: '2026-09-21T09:00:00Z', note: 'Assigned to Certification Branch - Pune' },
      ],
      assigned_department: 'BIS MITRA Demo Office - Pune',
      related_standard: 'IS DEMO 1001:2026',
      demo_id: 'CERT-DEMO-001',
      evidence_refs: [{ type: 'pdf', title: 'Form-I Acknowledgement', path: 'knowledge/pdfs/schemes/form-i-guidelines.pdf' }],
      source: 'eBIS Certification',
    },
    {
      workflow_id: 'WF-GRIEV-DEMO-001',
      service_id: 'SVC-GRIEV-001',
      persona: 'consumer',
      record_type: 'grievance',
      record_id: 'CMP-DEMO-001',
      application_id: 'CMP-DEMO-001',
      applicant_name: 'CON-DEMO-001',
      submitted_at: '2026-09-26T08:00:00Z',
      current_status: 'Inspection Scheduled',
      current_step: 'Field Inspection',
      next_action: 'Retain helmet sample; inspection scheduled for 2026-09-29 at Demo Town, Khordha.',
      status_history: [
        { status: 'Submitted', at: '2026-09-26T08:00:00Z', note: 'Complaint registered' },
        { status: 'Assigned', at: '2026-09-26T14:00:00Z', note: 'Officer OFF-DEMO-BBS-001 assigned' },
        { status: 'Inspection Scheduled', at: '2026-09-27T09:00:00Z', note: 'Sample collection scheduled' },
      ],
      assigned_department: 'BIS MITRA Demo Office - Bhubaneswar',
      related_standard: 'IS DEMO 1001:2026',
      related_licence: 'LIC-DEMO-26001',
      related_cml: 'CML-DEMO-61001',
      demo_id: 'CMP-DEMO-001',
      evidence_refs: [{ type: 'pdf', title: 'Complaint Acknowledgement', path: 'demo/consumer_complaints_demo.pdf' }],
      source: 'BIS Consumer Grievance Portal',
    },
    {
      workflow_id: 'WF-LAB-DEMO-001',
      service_id: 'SVC-LAB-001',
      persona: 'laboratory',
      record_type: 'lab_application',
      record_id: 'LAB-APP-DEMO-001',
      application_id: 'LAB-APP-DEMO-001',
      applicant_name: 'PrecisionTest Analytics Lab (Synthetic)',
      submitted_at: '2026-09-15T11:00:00Z',
      current_status: 'Inspection/Testing',
      current_step: 'On-site Evaluation',
      next_action: 'BIS evaluation team visit scheduled; ensure NABL scope documents are available.',
      status_history: [
        { status: 'Submitted', at: '2026-09-15T11:00:00Z', note: 'Recognition application received' },
        { status: 'Under Review', at: '2026-09-16T09:00:00Z', note: 'Document screening complete' },
        { status: 'Inspection/Testing', at: '2026-09-22T10:00:00Z', note: 'On-site evaluation initiated' },
      ],
      assigned_department: 'BIS Laboratory Recognition Cell',
      related_standard: 'IS DEMO 1001:2026, IS DEMO 1003:2025',
      demo_id: 'LAB-APP-DEMO-001',
      evidence_refs: [{ type: 'pdf', title: 'Lab Recognition Application', path: 'knowledge/pdfs/labs/lab-recognition-process.pdf' }],
      source: 'BIS Laboratory Recognition',
    },
    {
      workflow_id: 'WF-LIC-DEMO-001',
      service_id: 'SVC-LIC-001',
      persona: 'business',
      record_type: 'licence',
      record_id: 'LIC-DEMO-26001',
      application_id: 'LIC-DEMO-26001',
      applicant_name: 'Aarohan Safety Works Pvt. Ltd. (Synthetic)',
      submitted_at: '2026-02-12T00:00:00Z',
      current_status: 'Active',
      current_step: 'Valid Licence',
      next_action: 'Renewal due before 2027-08-11. Submit renewal application 90 days before expiry.',
      status_history: [
        { status: 'Granted', at: '2026-02-12T00:00:00Z', note: 'Initial certification granted' },
        { status: 'Active', at: '2026-08-01T00:00:00Z', note: 'Renewal processed' },
      ],
      assigned_department: 'Certification Registry',
      related_standard: 'IS DEMO 1001:2026',
      related_licence: 'LIC-DEMO-26001',
      related_cml: 'CML-DEMO-61001',
      demo_id: 'CERT-DEMO-001',
      evidence_refs: [{ type: 'pdf', title: 'Licence Certificate', path: 'demo/certification_demo.pdf' }],
      source: 'Certification Registry',
    },
  ];

  const ins = db.prepare(`
    INSERT OR REPLACE INTO ebis_workflow_instances
    (workflow_id, service_id, persona, record_type, record_id, application_id, applicant_name,
     submitted_at, current_status, current_step, next_action, status_history, assigned_department,
     related_standard, related_licence, related_cml, evidence_refs, source, demo_id, last_updated)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
  `);

  for (const w of instances) {
    ins.run(
      w.workflow_id, w.service_id, w.persona, w.record_type, w.record_id, w.application_id,
      w.applicant_name, w.submitted_at, w.current_status, w.current_step, w.next_action,
      JSON.stringify(w.status_history), w.assigned_department, w.related_standard || null,
      w.related_licence || null, w.related_cml || null,
      JSON.stringify(w.evidence_refs || []), w.source, w.demo_id,
    );
  }

  // Demo certification application record
  try {
    db.prepare(`
      INSERT OR IGNORE INTO applications
      (reference_id, company_name, factory_name, udyam_id, lab_report_ref, is_number, product_name, status, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      'BIS-APP-CERT-DEMO-001',
      'NovaShield Helmets Pvt. Ltd. (Synthetic)',
      'NovaShield Factory Unit-2, Pune',
      'UDYAM-MH-27-0099887',
      'TRL-DEMO-PPE-26099',
      'IS DEMO 1001:2026',
      'Industrial Safety Helmets - Model NSH-H5',
      'Under Review',
      '2026-09-20T10:30:00Z',
    );
  } catch { /* exists */ }

  // Demo lab recognition application
  try {
    db.prepare(`
      INSERT OR IGNORE INTO lab_applications
      (reference_id, lab_name, lab_code, city, state, scope, nabl_number, contact_email, status, current_step, demo_id, source_reference, source_file)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      'LAB-APP-DEMO-001',
      'PrecisionTest Analytics Lab (Synthetic)',
      null,
      'Hyderabad',
      'Telangana',
      'IS DEMO 1001:2026 (PPE), IS DEMO 1003:2025 (Electrical)',
      'NABL-DEMO-PTA-2026',
      'lab.demo@bis-mitra.in',
      'Inspection/Testing',
      'On-site Evaluation',
      'LAB-APP-DEMO-001',
      'BIS MITRA Demo → Laboratories → LAB-APP-DEMO-001',
      'laboratories_demo.pdf',
    );
  } catch { /* exists */ }
}

export function listServices({ persona } = {}) {
  const services = loadServices();
  if (persona) return services.filter(s => s.persona === persona || s.persona === 'general');
  return services;
}

export function getService(serviceId) {
  const svc = loadServices().find(s => s.service_id === serviceId);
  if (!svc) return null;
  const forms = loadForms();
  const form = svc.form_schema_id ? forms[svc.form_schema_id] : null;
  return { ...svc, form };
}

export function discoverService(query) {
  const q = String(query || '').toLowerCase();
  const services = loadServices();
  const scores = services.map(s => {
    let score = 0;
    const hay = `${s.service_name} ${s.description} ${s.persona} ${(s.eligibility || '')}`.toLowerCase();
    if (/\b(certif|licen[cs]e|isi|manufactur|apply|form-?i)\b/.test(q) && s.service_id === 'SVC-CERT-001') score += 10;
    if (/\b(complaint|grievance|consumer|file\s+a\s+complaint)\b/.test(q) && s.service_id === 'SVC-GRIEV-001') score += 10;
    if (/\b(lab|laboratory|recognition|nabl|testing\s+lab)\b/.test(q) && s.service_id === 'SVC-LAB-001') score += 10;
    if (/\b(renew|validity|existing\s+licen[cs]e|cml)\b/.test(q) && s.service_id === 'SVC-LIC-001') score += 10;
    if (/\b(huid|hallmark|gold|jewel)\b/.test(q) && s.service_id === 'SVC-HUID-001') score += 10;
    if (/\b(fmcs|import|foreign|exporter)\b/.test(q) && s.service_id === 'SVC-FMCS-001') score += 10;
    if (/\b(which\s+service|what\s+do\s+i\s+need|help\s+me|find\s+a\s+bis)\b/.test(q)) score += s.persona === 'general' ? 5 : 0;
    for (const word of q.split(/\s+/).filter(w => w.length > 3)) {
      if (hay.includes(word)) score += 1;
    }
    return { service: s, score };
  });
  return scores.filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.service);
}

function parseJsonField(val, fallback = []) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function enrichInstance(row) {
  if (!row) return null;
  const svc = getService(row.service_id);
  return {
    ...row,
    service_name: svc?.service_name,
    description: svc?.description,
    required_documents: svc?.required_documents || [],
    status_history: parseJsonField(row.status_history, []),
    evidence_refs: parseJsonField(row.evidence_refs, []),
    next_action: row.next_action || NEXT_ACTION_MAP[row.current_status] || 'Contact BIS helpdesk for guidance.',
  };
}

export function lookupStatus(db, recordId) {
  ensureWorkflowTables(db);
  const id = String(recordId || '').trim();
  if (!id) return { ok: false, error: 'record_id required' };

  // Workflow instance table
  const wf = db.prepare(
    'SELECT * FROM ebis_workflow_instances WHERE workflow_id = ? OR demo_id = ? OR record_id = ? OR application_id = ?'
  ).get(id, id, id, id);
  if (wf) {
    const enriched = enrichInstance(wf);
    return { ok: true, type: 'workflow', ...enriched, result: enriched.current_status };
  }

  // Applications
  const app = db.prepare('SELECT * FROM applications WHERE reference_id = ?').get(id)
    || db.prepare('SELECT * FROM applications WHERE reference_id LIKE ?').get(`%${id}%`);
  if (app) {
    return {
      ok: true, type: 'application', record_id: app.reference_id, application_id: app.reference_id,
      current_status: app.status, result: app.status,
      current_step: app.status === 'Under Review' ? 'Document Verification' : app.status,
      next_action: NEXT_ACTION_MAP[app.status] || 'Track via eBIS portal.',
      applicant_name: app.company_name, related_standard: app.is_number,
      submitted_at: app.submitted_at, source: 'eBIS Applications',
      service_id: 'SVC-CERT-001', persona: 'industry',
    };
  }

  // Grievances
  const griev = db.prepare('SELECT * FROM mock_grievances WHERE ticket_id = ? OR demo_id = ?').get(id, id);
  if (griev) {
    const status = (griev.status || 'PENDING').replace(/_/g, ' ');
    return {
      ok: true, type: 'grievance', record_id: griev.ticket_id, application_id: griev.ticket_id,
      current_status: status, result: status,
      current_step: griev.action || status,
      next_action: griev.officer_notes || NEXT_ACTION_MAP[griev.status] || NEXT_ACTION_MAP[status] || 'Await officer contact.',
      applicant_name: griev.consumer_name, related_standard: griev.is_number,
      assigned_department: griev.officer_name, submitted_at: griev.created_at,
      source: griev.source_reference || 'BIS Consumer Grievance Portal',
      service_id: 'SVC-GRIEV-001', persona: 'consumer', demo_id: griev.demo_id,
      evidence_refs: griev.evidence_upload ? [{ type: 'file', title: griev.evidence_upload }] : [],
    };
  }

  // Lab applications
  const labApp = db.prepare('SELECT * FROM lab_applications WHERE reference_id = ? OR demo_id = ?').get(id, id);
  if (labApp) {
    return {
      ok: true, type: 'lab_application', record_id: labApp.reference_id,
      application_id: labApp.reference_id, current_status: labApp.status, result: labApp.status,
      current_step: labApp.current_step || labApp.status,
      next_action: NEXT_ACTION_MAP[labApp.status] || 'Await BIS laboratory cell update.',
      applicant_name: labApp.lab_name, related_standard: labApp.scope,
      submitted_at: labApp.submitted_at, source: labApp.source_reference || 'BIS Laboratory Recognition',
      service_id: 'SVC-LAB-001', persona: 'laboratory', demo_id: labApp.demo_id,
    };
  }

  // Licences / CML via registry
  const lic = db.prepare(
    'SELECT * FROM mock_licensed_manufacturers WHERE demo_id = ? OR licence_number = ? OR cml_number = ?'
  ).get(id, id, id);
  if (lic) {
    return {
      ok: true, type: 'licence', record_id: lic.licence_number, application_id: lic.demo_id,
      current_status: lic.status, result: lic.status,
      current_step: lic.status === 'Active' ? 'Valid Licence' : lic.status,
      next_action: lic.valid_until
        ? `Valid until ${lic.valid_until}. Plan renewal before expiry.`
        : NEXT_ACTION_MAP[lic.status],
      applicant_name: lic.company_name, related_standard: lic.is_number,
      related_licence: lic.licence_number, related_cml: lic.cml_number,
      submitted_at: lic.valid_until, source: lic.source_reference || 'Certification Registry',
      service_id: 'SVC-LIC-001', persona: 'business', demo_id: lic.demo_id,
      evidence_refs: lic.source_file ? [{ type: 'pdf', title: 'Licence Record', path: `demo/${lic.source_file}` }] : [],
    };
  }

  return { ok: false, error: `No workflow record found for ${id}` };
}

// default export needs db passed for getWorkflowInstance - fix by using parameter
export function getWorkflowById(db, workflowId) {
  const row = db.prepare(
    'SELECT * FROM ebis_workflow_instances WHERE workflow_id = ? OR demo_id = ? OR record_id = ?'
  ).get(workflowId, workflowId, workflowId);
  return enrichInstance(row);
}
