import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'bis-clone.db');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    status TEXT DEFAULT 'Active',
    department TEXT,
    committee TEXT,
    mandatory_voluntary TEXT,
    reviewed_year INTEGER,
    pdf_path TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS product_manuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sr_no INTEGER,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    size_mb REAL,
    pdf_path TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marking_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    fee_amount TEXT NOT NULL,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS process_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    scheme TEXT,
    size_kb INTEGER,
    pdf_path TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    size_kb INTEGER,
    pdf_path TEXT NOT NULL,
    mime TEXT
  );

  CREATE TABLE IF NOT EXISTS referred_standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_is TEXT NOT NULL,
    referred_is TEXT NOT NULL,
    title TEXT,
    reviewed_year INTEGER
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT UNIQUE NOT NULL,
    company_name TEXT,
    is_number TEXT,
    product_name TEXT,
    status TEXT DEFAULT 'Under Review',
    submitted_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS application_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'BIS MITRA',
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS licences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    licence_number TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    is_number TEXT,
    product_name TEXT,
    status TEXT DEFAULT 'Active',
    valid_until TEXT
  );

  CREATE TABLE IF NOT EXISTS hallmarking_centres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centre_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    district TEXT,
    centre_type TEXT,
    status TEXT DEFAULT 'Active',
    contact TEXT
  );

  CREATE TABLE IF NOT EXISTS labs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lab_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    group_type TEXT NOT NULL,
    scope TEXT,
    status TEXT DEFAULT 'Recognised'
  );

  CREATE TABLE IF NOT EXISTS consumer_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS qco_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    is_number TEXT,
    gazette_ref TEXT,
    effective_date TEXT,
    scheme TEXT,
    sector TEXT,
    keywords TEXT,
    ministry TEXT,
    legal_statute TEXT
  );

  CREATE TABLE IF NOT EXISTS sit_manuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    scheme TEXT,
    testing_machinery TEXT,
    daily_log_template TEXT,
    pdf_path TEXT,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS layman_synonyms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colloquial TEXT NOT NULL,
    formal_terms TEXT NOT NULL,
    is_number TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    published_at TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    source_url TEXT
  );
`);

/** Soft-migrate older clone DBs */
function ensureColumn(table, column, typeSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  }
}
try {
  ensureColumn('qco_orders', 'ministry', 'TEXT');
  ensureColumn('qco_orders', 'legal_statute', 'TEXT');
  ensureColumn('labs', 'capability', 'TEXT');
  ensureColumn('labs', 'nabl_status', 'TEXT');
  ensureColumn('labs', 'queue_time_weeks', 'INTEGER');
  ensureColumn('applications', 'factory_name', 'TEXT');
  ensureColumn('applications', 'udyam_id', 'TEXT');
  ensureColumn('applications', 'lab_report_ref', 'TEXT');
  ensureColumn('applications', 'owner_session_id', 'TEXT');
  ensureColumn('applications', 'owner_user_id', 'TEXT');
  ensureColumn('applications', 'owner_persona', 'TEXT');
  ensureColumn('applications', 'contact_email', 'TEXT');
  ensureColumn('applications', 'declaration', 'TEXT');
  ensureColumn('fmcs_applications', 'owner_session_id', 'TEXT');
  ensureColumn('fmcs_applications', 'owner_user_id', 'TEXT');
  ensureColumn('fmcs_applications', 'owner_persona', 'TEXT');
  ensureColumn('compliance_alerts', 'target_personas', 'TEXT');
  ensureColumn('compliance_alerts', 'source', 'TEXT');
  ensureColumn('compliance_alerts', 'change_type', 'TEXT');
  ensureColumn('consumer_topics', 'body', 'TEXT');
  ensureColumn('consumer_topics', 'pdf_path', 'TEXT');
  ensureColumn('regulatory_guidance', 'pdf_path', 'TEXT');
  for (const t of ['standards', 'qco_orders', 'labs', 'licences', 'product_manuals',
    'mock_licensed_manufacturers', 'mock_grievances', 'mock_huid_ledger',
    'standard_amendments', 'layman_synonyms']) {
    ensureColumn(t, 'demo_id', 'TEXT');
    ensureColumn(t, 'source_reference', 'TEXT');
    ensureColumn(t, 'source_file', 'TEXT');
  }
  for (const col of ['certification_applicability', 'amendment_status', 'qco_reference', 'superseded_by_is']) {
    ensureColumn('standards', col, 'TEXT');
  }
} catch {
  /* ignore */
}

db.exec(`
  CREATE TABLE IF NOT EXISTS fee_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    enterprise_type TEXT NOT NULL,
    marking_fee INTEGER NOT NULL,
    msme_discount REAL DEFAULT 0,
    processing_weeks INTEGER NOT NULL,
    procedure_name TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS compliance_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    severity TEXT DEFAULT 'warning',
    is_number TEXT,
    published_at TEXT DEFAULT (datetime('now')),
    acknowledged INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS standard_amendments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    amendment_no TEXT NOT NULL,
    clause_ref TEXT,
    old_value TEXT,
    new_value TEXT,
    summary TEXT,
    published_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS standard_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    fingerprint TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regulatory_guidance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS inspection_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    check_id TEXT NOT NULL,
    question TEXT NOT NULL,
    critical INTEGER DEFAULT 1,
    clause_ref TEXT
  );

  CREATE TABLE IF NOT EXISTS fmcs_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hs_code TEXT,
    product_description TEXT NOT NULL,
    is_number TEXT NOT NULL,
    scheme TEXT NOT NULL,
    mandatory_import INTEGER DEFAULT 1,
    sector TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS fmcs_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    country_of_origin TEXT,
    factory_address TEXT,
    air_name TEXT,
    air_address TEXT,
    is_number TEXT,
    product_name TEXT,
    status TEXT DEFAULT 'Under Review',
    submitted_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fmcs_fee_matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    scheme TEXT NOT NULL,
    application_fee_inr INTEGER NOT NULL,
    travel_zone TEXT NOT NULL,
    travel_fee_eur REAL,
    travel_fee_usd REAL,
    processing_weeks INTEGER NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS treaty_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    agreement_name TEXT NOT NULL,
    agreement_type TEXT NOT NULL,
    sectors_covered TEXT,
    is_numbers_covered TEXT,
    testing_waiver INTEGER DEFAULT 0,
    audit_waiver INTEGER DEFAULT 0,
    effective_date TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_standards_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    part TEXT,
    scope TEXT,
    mechanical_safety TEXT,
    chemical_limits TEXT,
    lead_limit_mg_kg REAL,
    cadmium_limit_mg_kg REAL,
    qco_status TEXT DEFAULT 'Mandatory',
    effective_date TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    consumer_name TEXT,
    consumer_phone TEXT,
    consumer_email TEXT,
    merchant_name TEXT NOT NULL,
    product_category TEXT NOT NULL,
    product_name TEXT,
    is_number TEXT,
    invoice_number TEXT,
    evidence_upload TEXT,
    complaint_details TEXT,
    status TEXT DEFAULT 'PENDING',
    action TEXT,
    officer_name TEXT,
    officer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mock_qco_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    product TEXT NOT NULL,
    gazette_ref TEXT NOT NULL,
    ministry TEXT,
    legal_statute TEXT,
    penal_clause TEXT,
    dispute_leverage_text TEXT,
    effective_date TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_licensed_manufacturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cml_number TEXT UNIQUE NOT NULL,
    licence_number TEXT,
    factory TEXT NOT NULL,
    company_name TEXT NOT NULL,
    status TEXT NOT NULL,
    is_number TEXT NOT NULL,
    product TEXT,
    valid_until TEXT,
    cancellation_reason TEXT,
    risk_assessment TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_hazard_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hazard_id TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    is_number TEXT,
    hazard_category TEXT NOT NULL,
    severity TEXT DEFAULT 'critical',
    store_location TEXT,
    report_text TEXT,
    status TEXT DEFAULT 'DISPATCHED_ENFORCEMENT',
    notified_cells TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bilingual_consumer_rights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    lang TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    points_json TEXT NOT NULL,
    formatted_text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mock_hallmark_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stamp TEXT UNIQUE NOT NULL,
    purity_percentage TEXT NOT NULL,
    carat INTEGER,
    logo TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_huid_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    huid TEXT UNIQUE NOT NULL,
    jeweller_name TEXT NOT NULL,
    assaying_center TEXT,
    stamping_date TEXT NOT NULL,
    weight_grams REAL,
    status TEXT DEFAULT 'VERIFIED'
  );

  CREATE TABLE IF NOT EXISTS mock_gold_grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    jeweller_name TEXT,
    store_location TEXT,
    complaint_details TEXT,
    status TEXT DEFAULT 'DISPATCHED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gold_market_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate_per_gram_inr REAL NOT NULL,
    effective_date TEXT
  );

  CREATE TABLE IF NOT EXISTS lab_environmental_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    clause_ref TEXT,
    ambient_temp_c TEXT,
    relative_humidity_pct TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS lab_test_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_id TEXT UNIQUE NOT NULL,
    sample_id TEXT NOT NULL,
    is_number TEXT,
    value_mpa REAL,
    status TEXT,
    logged_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS validation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT,
    row_number INTEGER,
    field_name TEXT,
    value_recorded TEXT,
    threshold_min REAL,
    is_number TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proficiency_testing_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    masked_key TEXT,
    lab_name TEXT,
    lab_city TEXT,
    status TEXT DEFAULT 'DISPATCHED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS engineering_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT,
    table_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS semester_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT,
    amendment_no TEXT,
    summary TEXT,
    published_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS formula_derivations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    formula TEXT NOT NULL,
    variables_json TEXT,
    example_calculation TEXT,
    source_clause TEXT
  );

  CREATE TABLE IF NOT EXISTS standard_revision_diffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    parameter_field TEXT NOT NULL,
    old_edition TEXT,
    new_edition TEXT,
    old_value TEXT,
    new_value TEXT,
    evolution_context TEXT
  );

  CREATE TABLE IF NOT EXISTS mock_seizure_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT UNIQUE NOT NULL,
    product_description TEXT NOT NULL,
    units INTEGER,
    location TEXT,
    officer_id TEXT,
    status TEXT DEFAULT 'LOCKED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mock_customs_hs_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hs_code TEXT UNIQUE NOT NULL,
    product_description TEXT,
    is_number TEXT NOT NULL,
    qco_mandatory INTEGER DEFAULT 1,
    clearance_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS emergency_seal_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    cml_number TEXT NOT NULL,
    legal_authority TEXT,
    status TEXT DEFAULT 'EXECUTED',
    signed_token TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

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

export default db;
