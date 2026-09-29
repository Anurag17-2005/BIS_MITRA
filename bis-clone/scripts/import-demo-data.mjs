/**
 * Import BIS MITRA synthetic demo datasets from /data/ into bis-clone.db.
 * Called at end of seed.js — transforms fields; does not modify source files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedWorkflowInstances } from '../api/workflow-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, '..', '..', 'data');
const FILES_DEMO = path.join(__dirname, '..', 'public', 'files', 'demo');
const KNOWLEDGE_DEMO = path.join(__dirname, '..', 'data', 'knowledge', 'pdfs', 'demo');

const SOURCE_FILES = {
  standards: 'standards_demo.pdf',
  qco: 'qco_demo.pdf',
  certification: 'certification_demo.pdf',
  laboratories: 'laboratories_demo.pdf',
  hallmarking: 'hallmarking_demo.pdf',
  consumer: 'consumer_complaints_demo.pdf',
  enforcement: 'enforcement_demo.pdf',
  surveillance: 'surveillance_demo.pdf',
};

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    if (text[i] === '\n' || text[i] === '\r') { i++; continue; }
    const row = [];
    while (i < len) {
      let val = '';
      if (text[i] === '"') {
        i++;
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') { val += '"'; i += 2; }
            else { i++; break; }
          } else { val += text[i++]; }
        }
      } else {
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') val += text[i++];
      }
      row.push(val);
      if (text[i] === ',') { i++; continue; }
      while (i < len && (text[i] === '\n' || text[i] === '\r')) i++;
      break;
    }
    if (row.some(c => c.trim())) rows.push(row);
  }
  return rows;
}

function csvToObjects(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  let headerIdx = rows.findIndex(r => r.includes('demo_id') || r[0] === 'demo_id');
  if (headerIdx < 0) {
    headerIdx = 0;
    while (headerIdx < rows.length && (rows[headerIdx][0]?.includes('⭐') || !rows[headerIdx].includes('demo_id'))) headerIdx++;
  }
  const headers = rows[headerIdx];
  return rows.slice(headerIdx + 1).map(cells => {
    const o = {};
    headers.forEach((h, idx) => { o[h.trim()] = (cells[idx] || '').trim(); });
    return o;
  }).filter(r => r.demo_id || r.complaint_id || r.surveillance_id || r.case_id);
}

function srcRef(domain, demoId) {
  return `BIS MITRA Demo → ${domain} → ${demoId}`;
}

function copyDemoPdfs() {
  fs.mkdirSync(FILES_DEMO, { recursive: true });
  fs.mkdirSync(KNOWLEDGE_DEMO, { recursive: true });
  for (const [, name] of Object.entries(SOURCE_FILES)) {
    const src = path.join(DATA_ROOT, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(FILES_DEMO, name));
      fs.copyFileSync(src, path.join(KNOWLEDGE_DEMO, name));
    }
  }
}

function ensureProvenanceColumns(db) {
  const tables = [
    'standards', 'qco_orders', 'labs', 'licences', 'product_manuals',
    'mock_licensed_manufacturers', 'mock_grievances', 'mock_huid_ledger',
    'standard_amendments', 'layman_synonyms', 'enforcement_cases', 'surveillance_cases',
  ];
  for (const t of tables) {
    for (const col of ['demo_id', 'source_reference', 'source_file']) {
      const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} TEXT`);
      }
    }
  }
  for (const col of ['certification_applicability', 'amendment_status', 'qco_reference', 'superseded_by_is']) {
    const cols = db.prepare('PRAGMA table_info(standards)').all().map(c => c.name);
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE standards ADD COLUMN ${col} TEXT`);
    }
  }
}

function ensureNewTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enforcement_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demo_id TEXT UNIQUE,
      case_id TEXT UNIQUE NOT NULL,
      inspection_id TEXT,
      inspection_type TEXT,
      inspection_date TEXT,
      location TEXT,
      state TEXT,
      manufacturer TEXT,
      product TEXT,
      is_number TEXT,
      qco_reference TEXT,
      licence_number TEXT,
      finding TEXT,
      non_conformity TEXT,
      severity TEXT,
      evidence TEXT,
      action_taken TEXT,
      case_status TEXT,
      surveillance_reference TEXT,
      laboratory_reference TEXT,
      source_reference TEXT,
      source_file TEXT
    );
    CREATE TABLE IF NOT EXISTS surveillance_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demo_id TEXT UNIQUE,
      surveillance_id TEXT UNIQUE NOT NULL,
      surveillance_type TEXT,
      surveillance_date TEXT,
      product TEXT,
      product_category TEXT,
      manufacturer TEXT,
      location TEXT,
      state TEXT,
      is_number TEXT,
      qco_reference TEXT,
      licence_number TEXT,
      sample_id TEXT,
      laboratory TEXT,
      test_report_reference TEXT,
      test_result TEXT,
      compliance_status TEXT,
      risk_level TEXT,
      finding TEXT,
      enforcement_case_reference TEXT,
      source_reference TEXT,
      source_file TEXT
    );
  `);
}

function importStandards(db) {
  const jsonPath = path.join(DATA_ROOT, 'standards_demo.json');
  if (!fs.existsSync(jsonPath)) return;
  const { records } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const idToIs = {};
  for (const r of records) idToIs[r.demo_id] = r.standard_number;

  const upsert = db.prepare(`
    INSERT INTO standards (is_number, title, year, status, department, committee, mandatory_voluntary,
      reviewed_year, pdf_path, description, demo_id, source_reference, source_file,
      certification_applicability, amendment_status, qco_reference, superseded_by_is)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(is_number) DO UPDATE SET
      title=excluded.title, year=excluded.year, status=excluded.status, department=excluded.department,
      committee=excluded.committee, mandatory_voluntary=excluded.mandatory_voluntary,
      reviewed_year=excluded.reviewed_year, pdf_path=excluded.pdf_path, description=excluded.description,
      demo_id=excluded.demo_id, source_reference=excluded.source_reference, source_file=excluded.source_file,
      certification_applicability=excluded.certification_applicability, amendment_status=excluded.amendment_status,
      qco_reference=excluded.qco_reference, superseded_by_is=excluded.superseded_by_is
  `);

  const insManual = db.prepare(`
    INSERT INTO product_manuals (sr_no, is_number, title, size_mb, pdf_path, demo_id, source_reference, source_file)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const insRef = db.prepare(`
    INSERT INTO referred_standards (parent_is, referred_is, title, reviewed_year)
    VALUES (?,?,?,?)
  `);

  let sr = 100;
  for (const r of records) {
    const isNum = r.standard_number;
    const mandatory = /certification applicable|mandatory/i.test(r.certification_applicability || '') && r.qco_reference
      ? 'Mandatory' : (/voluntary/i.test(r.certification_applicability || '') ? 'Voluntary' : 'Mandatory');
    const supersededBy = r.superseded_by ? idToIs[r.superseded_by] || null : null;
    const descParts = [r.scope, r.applicability];
    if (r.key_requirements?.length) descParts.push('Key requirements: ' + r.key_requirements.slice(0, 3).join('; '));
    if (r.testing_requirements?.length) descParts.push('Testing: ' + r.testing_requirements.slice(0, 2).join('; '));
    const reviewedYear = r.last_reviewed ? parseInt(r.last_reviewed.slice(0, 4), 10) : parseInt(r.edition_year, 10);

    upsert.run(
      isNum, r.title, parseInt(r.edition_year, 10), r.status, r.sector, r.sub_sector || r.standard_type,
      mandatory, reviewedYear, 'demo/standards_demo.pdf', descParts.join('\n\n'),
      r.demo_id, srcRef('Standards', r.demo_id), SOURCE_FILES.standards,
      r.certification_applicability, r.amendment_status, r.qco_reference, supersededBy,
    );

    try {
      insManual.run(sr++, isNum, `${r.title} (Demo catalog)`, 0.1, 'demo/standards_demo.pdf',
        r.demo_id, srcRef('Standards', r.demo_id), SOURCE_FILES.standards);
    } catch { /* duplicate sr */ }

    if (Array.isArray(r.related_standards)) {
      for (const relId of r.related_standards) {
        const relIs = idToIs[relId];
        if (relIs && relIs !== isNum) {
          try { insRef.run(isNum, relIs, null, reviewedYear); } catch { /* dup */ }
        }
      }
    }
    if (supersededBy) {
      try { insRef.run(isNum, supersededBy, 'Superseded by', reviewedYear); } catch { /* dup */ }
    }

    if (r.amendment_status === 'Amended' && r.amendment) {
      const a = r.amendment;
      db.prepare(`
        INSERT INTO standard_amendments (is_number, amendment_no, clause_ref, old_value, new_value, summary, published_at, demo_id, source_reference, source_file)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(
        isNum, a.amendment_number || r.amendment_reference, a.affected_clause,
        a.previous_requirement, a.revised_requirement, a.reason_for_change || '',
        a.amendment_date || r.published_date, r.demo_id, srcRef('Standards', r.demo_id), SOURCE_FILES.standards,
      );
    }

    if (Array.isArray(r.synonyms)) {
      for (const syn of r.synonyms) {
        try {
          db.prepare(`
            INSERT INTO layman_synonyms (colloquial, formal_terms, is_number, notes, demo_id, source_reference, source_file)
            VALUES (?,?,?,?,?,?,?)
          `).run(syn, r.title, isNum, `Demo synonym for ${r.demo_id}`, r.demo_id, srcRef('Standards', r.demo_id), SOURCE_FILES.standards);
        } catch { /* dup */ }
      }
    }
    if (Array.isArray(r.keywords)) {
      for (const kw of r.keywords.slice(0, 3)) {
        try {
          db.prepare(`
            INSERT INTO layman_synonyms (colloquial, formal_terms, is_number, notes, demo_id, source_reference, source_file)
            VALUES (?,?,?,?,?,?,?)
          `).run(kw, r.title, isNum, `Keyword for ${r.demo_id}`, r.demo_id, srcRef('Standards', r.demo_id), SOURCE_FILES.standards);
        } catch { /* dup */ }
      }
    }
  }
  db.prepare(`
    UPDATE standards SET qco_reference = (
      SELECT q.demo_id FROM qco_orders q WHERE q.is_number = standards.is_number LIMIT 1
    ) WHERE demo_id IS NOT NULL
  `).run();
}

function importQco(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'qco_demo.csv'));
  const ins = db.prepare(`
    INSERT INTO qco_orders (product, is_number, gazette_ref, effective_date, scheme, sector, keywords, ministry, legal_statute, demo_id, source_reference, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const r of rows) {
    const products = (r.covered_products || r.title || '').split(';')[0].trim();
    ins.run(
      products, r.applicable_standard, r.qco_number, r.effective_date,
      r.certification_scheme || 'Scheme-I (ISI Mark)', r.product_category,
      r.keywords || '', r.issuing_authority, r.enforcement_notes || r.scope || '',
      r.demo_id, r.source_reference || srcRef('QCO', r.demo_id), SOURCE_FILES.qco,
    );
  }
}

function importCertification(db) {
  db.prepare('DELETE FROM mock_licensed_manufacturers WHERE demo_id IS NOT NULL').run();
  db.prepare('DELETE FROM licences WHERE demo_id IS NOT NULL').run();
  const rows = csvToObjects(path.join(DATA_ROOT, 'certification_demo.csv'));
  for (const r of rows) {
    const cml = r.cml_number || '';
    const status = /suspended/i.test(r.licence_status || '') ? 'Suspended' : 'Active';
    const risk = r.suspension_cancellation_details || 'Verified in demo registry.';
    try {
      db.prepare(`
        INSERT INTO mock_licensed_manufacturers (cml_number, licence_number, factory, company_name, status, is_number, product, valid_until, risk_assessment, demo_id, source_reference, source_file)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        cml, r.licence_number, r.manufacturing_location || r.manufacturer_address,
        r.manufacturer_name, status, r.applicable_standard, r.product_name, r.validity_date,
        risk, r.demo_id, srcRef('Certification', r.demo_id), SOURCE_FILES.certification,
      );
    } catch { /* dup cml */ }

    try {
      db.prepare(`
        INSERT INTO licences (licence_number, org_id, company_name, is_number, product_name, status, valid_until, demo_id, source_reference, source_file)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(
        r.licence_number, `ORG-${r.demo_id}`, r.manufacturer_name, r.applicable_standard,
        r.product_name, status, r.validity_date, r.demo_id, srcRef('Certification', r.demo_id), SOURCE_FILES.certification,
      );
    } catch { /* dup licence */ }
  }
}

function importLabs(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'laboratories_demo.csv'));
  const ins = db.prepare(`
    INSERT INTO labs (lab_code, name, city, state, group_type, scope, capability, nabl_status, queue_time_weeks, status, demo_id, source_reference, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(lab_code) DO UPDATE SET
      name=excluded.name, city=excluded.city, state=excluded.state, scope=excluded.scope,
      capability=excluded.capability, nabl_status=excluded.nabl_status, demo_id=excluded.demo_id,
      source_reference=excluded.source_reference, source_file=excluded.source_file
  `);
  for (const r of rows) {
    const loc = (r.location || '').split(',')[0].trim();
    const turnaround = parseInt(r.typical_turnaround_days, 10) || 5;
    ins.run(
      r.laboratory_id || r.registration_number, r.laboratory_name, loc, r.state,
      'Group-2 Empanelled', r.scope_of_testing, r['equipment/capabilities'] || r.available_tests,
      r.accreditation_status, Math.max(1, Math.ceil(turnaround / 7)), r.laboratory_status || 'Recognised',
      r.demo_id, srcRef('Laboratories', r.demo_id), SOURCE_FILES.laboratories,
    );
  }
}

function importHallmarking(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'hallmarking_demo.csv'));
  for (const r of rows) {
    const fineness = (r['purity/fineness'] || '').match(/(\d+)/);
    const purityPct = fineness ? `${(parseInt(fineness[1], 10) / 10).toFixed(1)}%` : '91.6%';
    const carat = fineness ? Math.round(parseInt(fineness[1], 10) / 41.6) : 22;
    const stamp = `${carat}K${fineness ? fineness[1] : '916'}`;
    const weight = parseFloat((r.net_weight || '0').replace(/[^\d.]/g, '')) || null;

    try {
      db.prepare(`
        INSERT INTO mock_huid_ledger (huid, jeweller_name, assaying_center, stamping_date, weight_grams, status, demo_id, source_reference, source_file)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        r.huid, r.jeweller_name, r.ahc_name, r.hallmarking_date, weight, 'VERIFIED',
        r.demo_id, srcRef('Hallmarking', r.demo_id), SOURCE_FILES.hallmarking,
      );
    } catch { /* dup huid */ }

    try {
      db.prepare(`
        INSERT INTO mock_hallmark_registry (stamp, purity_percentage, carat, logo, notes)
        VALUES (?,?,?,?,?)
      `).run(stamp, purityPct, carat, 'BIS Triangular Mark', `${r.jewellery_description} [${r.demo_id}]`);
    } catch { /* dup stamp */ }
  }
}

function importComplaints(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'consumer_complaints_demo.csv'));
  for (const r of rows) {
    const ticketId = r.complaint_id || r.demo_id;
    try {
      db.prepare(`
        INSERT INTO mock_grievances (ticket_id, consumer_name, merchant_name, product_category, product_name, is_number, complaint_details, status, action, officer_notes, demo_id, source_reference, source_file)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        ticketId, r.consumer_reference || 'Demo Consumer', r['manufacturer/seller'] || 'Unknown',
        r.product_category, r.product_name, r.related_standard, r.complaint_description,
        (r.current_status || 'PENDING').replace(/\s+/g, '_').toUpperCase(),
        r.inspection_required === 'Yes' ? 'Inspection scheduled' : 'Under review',
        r.resolution || r.assigned_bis_office || '', r.demo_id,
        srcRef('Consumer Complaints', r.demo_id), SOURCE_FILES.consumer,
      );
    } catch { /* dup ticket */ }
  }
}

function importEnforcement(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'enforcement_demo.csv'));
  const ins = db.prepare(`
    INSERT OR REPLACE INTO enforcement_cases (demo_id, case_id, inspection_id, inspection_type, inspection_date, location, state, manufacturer, product, is_number, qco_reference, licence_number, finding, non_conformity, severity, evidence, action_taken, case_status, surveillance_reference, laboratory_reference, source_reference, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const r of rows) {
    ins.run(
      r.demo_id, r.case_id || r.demo_id, r.inspection_id, r.inspection_type, r.inspection_date,
      r.location, r.state, r.manufacturer, r.product, r.standard_number, r.qco_reference,
      r.licence_number, r.finding, r.non_conformity, r.severity, r.evidence, r.action_taken,
      r.case_status, r.surveillance_reference, r.laboratory_reference,
      srcRef('Enforcement', r.demo_id), SOURCE_FILES.enforcement,
    );
  }
}

function importSurveillance(db) {
  const rows = csvToObjects(path.join(DATA_ROOT, 'surveillance_demo.csv'));
  const ins = db.prepare(`
    INSERT OR REPLACE INTO surveillance_cases (demo_id, surveillance_id, surveillance_type, surveillance_date, product, product_category, manufacturer, location, state, is_number, qco_reference, licence_number, sample_id, laboratory, test_report_reference, test_result, compliance_status, risk_level, finding, enforcement_case_reference, source_reference, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const r of rows) {
    ins.run(
      r.demo_id, r.surveillance_id || r.demo_id, r.surveillance_type, r.surveillance_date,
      r.product, r.product_category, r.manufacturer, r.location, r.state, r.standard_number,
      r.qco_reference, r.licence_number, r.sample_id, r.laboratory, r.test_report_reference,
      r.test_result, r.compliance_status, r.risk_level, r.finding, r.enforcement_case_reference,
      srcRef('Surveillance', r.demo_id), SOURCE_FILES.surveillance,
    );
  }
}

export function importDemoData(db) {
  if (!fs.existsSync(DATA_ROOT)) {
    console.warn('[import-demo] /data/ not found — skipping demo import');
    return;
  }
  copyDemoPdfs();
  ensureNewTables(db);
  ensureProvenanceColumns(db);
  importStandards(db);
  importQco(db);
  importCertification(db);
  importLabs(db);
  importHallmarking(db);
  importComplaints(db);
  importEnforcement(db);
  importSurveillance(db);
  try {
    seedWorkflowInstances(db);
    console.log('[import-demo] eBIS workflow demo instances seeded');
  } catch (err) {
    console.warn('[import-demo] workflow seed skipped:', err.message);
  }
  console.log('[import-demo] BIS MITRA demo datasets imported into bis-clone.db');
}

if (process.argv[1] && process.argv[1].endsWith('import-demo-data.mjs')) {
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.join(__dirname, '..', 'data', 'bis-clone.db');
  const db = new Database(dbPath);
  importDemoData(db);
  db.close();
}
