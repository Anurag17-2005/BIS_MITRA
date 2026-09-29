import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'bis-clone.db');
const db = new Database(dbPath);

db.exec(`
  DROP TABLE IF EXISTS mock_standards_catalog;
  DROP TABLE IF EXISTS mock_grievances;
  DROP TABLE IF EXISTS mock_qco_registry;
  DROP TABLE IF EXISTS mock_licensed_manufacturers;
  DROP TABLE IF EXISTS mock_hazard_alerts;
  DROP TABLE IF EXISTS bilingual_consumer_rights;
  DROP TABLE IF EXISTS mock_hallmark_registry;
  DROP TABLE IF EXISTS mock_huid_ledger;
  DROP TABLE IF EXISTS mock_gold_grievances;
  DROP TABLE IF EXISTS gold_market_rates;
  DROP TABLE IF EXISTS lab_environmental_specs;
  DROP TABLE IF EXISTS lab_test_certificates;
  DROP TABLE IF EXISTS validation_logs;
  DROP TABLE IF EXISTS proficiency_testing_ledger;
  DROP TABLE IF EXISTS engineering_tables;
  DROP TABLE IF EXISTS semester_publications;
  DROP TABLE IF EXISTS formula_derivations;
  DROP TABLE IF EXISTS standard_revision_diffs;
  DROP TABLE IF EXISTS mock_seizure_ledger;
  DROP TABLE IF EXISTS mock_customs_hs_mapping;
  DROP TABLE IF EXISTS emergency_seal_orders;
  DROP TABLE IF EXISTS surveillance_cases;
  DROP TABLE IF EXISTS enforcement_cases;
  DROP TABLE IF EXISTS fmcs_catalog;
  DROP TABLE IF EXISTS fmcs_applications;
  DROP TABLE IF EXISTS fmcs_fee_matrix;
  DROP TABLE IF EXISTS treaty_registry;
  DROP TABLE IF EXISTS inspection_checklists;
  DROP TABLE IF EXISTS regulatory_guidance;
  DROP TABLE IF EXISTS standard_fingerprints;
  DROP TABLE IF EXISTS standard_amendments;
  DROP TABLE IF EXISTS compliance_alerts;
  DROP TABLE IF EXISTS fee_structures;
  DROP TABLE IF EXISTS layman_synonyms;
  DROP TABLE IF EXISTS sit_manuals;
  DROP TABLE IF EXISTS qco_orders;
  DROP TABLE IF EXISTS consumer_topics;
  DROP TABLE IF EXISTS labs;
  DROP TABLE IF EXISTS hallmarking_centres;
  DROP TABLE IF EXISTS licences;
  DROP TABLE IF EXISTS application_status_history;
  DROP TABLE IF EXISTS applications;
  DROP TABLE IF EXISTS referred_standards;
  DROP TABLE IF EXISTS portal_documents;
  DROP TABLE IF EXISTS process_documents;
  DROP TABLE IF EXISTS marking_fees;
  DROP TABLE IF EXISTS product_manuals;
  DROP TABLE IF EXISTS standards;
  DROP TABLE IF EXISTS news;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT
  );
  CREATE TABLE standards (
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
  CREATE TABLE product_manuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sr_no INTEGER,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    size_mb REAL,
    pdf_path TEXT NOT NULL
  );
  CREATE TABLE marking_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    fee_amount TEXT NOT NULL,
    keywords TEXT
  );
  CREATE TABLE process_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    scheme TEXT,
    size_kb INTEGER,
    pdf_path TEXT NOT NULL
  );
  CREATE TABLE portal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    size_kb INTEGER,
    pdf_path TEXT NOT NULL,
    mime TEXT
  );
  CREATE TABLE referred_standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_is TEXT NOT NULL,
    referred_is TEXT NOT NULL,
    title TEXT,
    reviewed_year INTEGER
  );
  CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT UNIQUE NOT NULL,
    company_name TEXT,
    factory_name TEXT,
    udyam_id TEXT,
    lab_report_ref TEXT,
    is_number TEXT,
    product_name TEXT,
    status TEXT DEFAULT 'Under Review',
    submitted_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE licences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    licence_number TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    is_number TEXT,
    product_name TEXT,
    status TEXT DEFAULT 'Active',
    valid_until TEXT
  );
  CREATE TABLE hallmarking_centres (
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
  CREATE TABLE labs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lab_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    group_type TEXT NOT NULL,
    scope TEXT,
    capability TEXT,
    nabl_status TEXT,
    queue_time_weeks INTEGER,
    status TEXT DEFAULT 'Recognised'
  );
  CREATE TABLE consumer_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    keywords TEXT,
    body TEXT,
    pdf_path TEXT
  );
  CREATE TABLE qco_orders (
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
  CREATE TABLE sit_manuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT NOT NULL,
    scheme TEXT,
    testing_machinery TEXT,
    daily_log_template TEXT,
    pdf_path TEXT,
    summary TEXT
  );
  CREATE TABLE layman_synonyms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colloquial TEXT NOT NULL,
    formal_terms TEXT NOT NULL,
    is_number TEXT,
    notes TEXT
  );
  CREATE TABLE news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    published_at TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    source_url TEXT
  );

  CREATE TABLE fee_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    enterprise_type TEXT NOT NULL,
    marking_fee INTEGER NOT NULL,
    msme_discount REAL DEFAULT 0,
    processing_weeks INTEGER NOT NULL,
    procedure_name TEXT,
    notes TEXT
  );

  CREATE TABLE compliance_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    severity TEXT DEFAULT 'warning',
    is_number TEXT,
    target_personas TEXT,
    source TEXT,
    change_type TEXT,
    published_at TEXT DEFAULT (datetime('now')),
    acknowledged INTEGER DEFAULT 0
  );

  CREATE TABLE standard_amendments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    amendment_no TEXT NOT NULL,
    clause_ref TEXT,
    old_value TEXT,
    new_value TEXT,
    summary TEXT,
    published_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE standard_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    fingerprint TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE regulatory_guidance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    keywords TEXT
  );

  CREATE TABLE inspection_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    check_id TEXT NOT NULL,
    question TEXT NOT NULL,
    critical INTEGER DEFAULT 1,
    clause_ref TEXT
  );

  CREATE TABLE fmcs_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hs_code TEXT,
    product_description TEXT NOT NULL,
    is_number TEXT NOT NULL,
    scheme TEXT NOT NULL,
    mandatory_import INTEGER DEFAULT 1,
    sector TEXT,
    notes TEXT
  );

  CREATE TABLE fmcs_applications (
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

  CREATE TABLE fmcs_fee_matrix (
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

  CREATE TABLE treaty_registry (
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

  CREATE TABLE mock_standards_catalog (
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

  CREATE TABLE mock_grievances (
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

  CREATE TABLE mock_qco_registry (
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

  CREATE TABLE mock_licensed_manufacturers (
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

  CREATE TABLE mock_hazard_alerts (
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

  CREATE TABLE bilingual_consumer_rights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    lang TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    points_json TEXT NOT NULL,
    formatted_text TEXT NOT NULL
  );

  CREATE TABLE mock_hallmark_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stamp TEXT UNIQUE NOT NULL,
    purity_percentage TEXT NOT NULL,
    carat INTEGER,
    logo TEXT,
    notes TEXT
  );

  CREATE TABLE mock_huid_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    huid TEXT UNIQUE NOT NULL,
    jeweller_name TEXT NOT NULL,
    assaying_center TEXT,
    stamping_date TEXT NOT NULL,
    weight_grams REAL,
    status TEXT DEFAULT 'VERIFIED'
  );

  CREATE TABLE mock_gold_grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    jeweller_name TEXT,
    store_location TEXT,
    complaint_details TEXT,
    status TEXT DEFAULT 'DISPATCHED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE gold_market_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate_per_gram_inr REAL NOT NULL,
    effective_date TEXT
  );

  CREATE TABLE lab_environmental_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    clause_ref TEXT,
    ambient_temp_c TEXT,
    relative_humidity_pct TEXT,
    notes TEXT
  );

  CREATE TABLE lab_test_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_id TEXT UNIQUE NOT NULL,
    sample_id TEXT NOT NULL,
    is_number TEXT,
    value_mpa REAL,
    status TEXT,
    logged_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE validation_logs (
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

  CREATE TABLE proficiency_testing_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    masked_key TEXT,
    lab_name TEXT,
    lab_city TEXT,
    status TEXT DEFAULT 'DISPATCHED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE engineering_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT,
    table_json TEXT NOT NULL
  );

  CREATE TABLE semester_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    title TEXT,
    amendment_no TEXT,
    summary TEXT,
    published_at TEXT NOT NULL
  );

  CREATE TABLE formula_derivations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    formula TEXT NOT NULL,
    variables_json TEXT,
    example_calculation TEXT,
    source_clause TEXT
  );

  CREATE TABLE standard_revision_diffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    parameter_field TEXT NOT NULL,
    old_edition TEXT,
    new_edition TEXT,
    old_value TEXT,
    new_value TEXT,
    evolution_context TEXT
  );

  CREATE TABLE mock_seizure_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT UNIQUE NOT NULL,
    product_description TEXT NOT NULL,
    units INTEGER,
    location TEXT,
    officer_id TEXT,
    status TEXT DEFAULT 'LOCKED',
    case_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE mock_customs_hs_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hs_code TEXT UNIQUE NOT NULL,
    product_description TEXT,
    is_number TEXT NOT NULL,
    qco_mandatory INTEGER DEFAULT 1,
    clearance_notes TEXT
  );

  CREATE TABLE emergency_seal_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    cml_number TEXT NOT NULL,
    legal_authority TEXT,
    status TEXT DEFAULT 'EXECUTED',
    signed_token TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE enforcement_cases (
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

  CREATE TABLE surveillance_cases (
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


db.prepare(`INSERT INTO users (email, password, name) VALUES (?, ?, ?)`).run(
  'demo@bis-mitra.in', 'Demo@123', 'Demo User'
);

const standards = [
  ['IS 4151:2015', 'PROTECTIVE HELMET FOR TWO WHEELER RIDERS', 2015, 'Active', 'Mechanical Engineering', 'MED 13', 'Mandatory', 2024,
   'knowledge/pdfs/manuals/PM-IS-4151-helmet-2024.pdf', 'Specification for protective helmets for two wheeler riders'],
  ['IS 623:2025', 'BICYCLES - BICYCLE FRAMES - SPECIFICATION (First Revision)', 2025, 'Active', 'Transport Engineering', 'TED 16', 'Mandatory', 2025,
   'knowledge/pdfs/manuals/PM-IS-623-bicycle-frame-2024.pdf', 'Bicycle frames specification for cycle manufacturing'],
  ['IS 3055 (Part 1):1994', 'Clinical Thermometers – Solid stem Type', 1994, 'Active', 'Medical Equipment', 'CHD 8', 'Mandatory', 2020,
   'knowledge/pdfs/manuals/PM-IS-3055-clinical-thermometer.pdf', 'Clinical thermometers solid stem type specification'],
  ['IS 1:1968', 'SPECIFICATION FOR THE NATIONAL FLAG OF INDIA (COTTON KHADI)', 1968, 'Active', 'Textile', 'TXD 1', 'Voluntary', 2018, null, 'National flag specification'],
  ['IS 170:2020', 'ACETONE', 2020, 'Active', 'Chemical', 'CHD 1', 'Mandatory', 2020, null, 'Acetone chemical specification'],
  ['IS 2062:2011', 'HOT ROLLED MEDIUM AND HIGH TENSILE STRUCTURAL STEEL', 2011, 'Active', 'Civil Engineering', 'CED 54', 'Mandatory', 2022, null, 'Structural steel for construction'],
  ['IS 15844:2010', 'SELF BALLASTED LED LAMPS FOR GENERAL LIGHTING SERVICES', 2010, 'Active', 'Electrotechnical', 'ETD 34', 'Mandatory', 2021, null, 'LED lamps under CRS Scheme-II'],
  ['IS 13252 (Part 1):2010', 'IT EQUIPMENT SAFETY - GENERAL REQUIREMENTS', 2010, 'Active', 'Electrotechnical', 'ETD 20', 'Mandatory', 2020, null, 'Electronics IT equipment safety under CRS'],
  ['IS 2082:2018', 'STATIONARY STORAGE TYPE ELECTRIC WATER HEATERS', 2018, 'Active', 'Electrotechnical', 'ETD 32', 'Mandatory', 2024,
   null, 'Storage electric water heaters (geysers) — hydrostatic and safety requirements'],
  ['IS 14543:2016', 'PACKAGED DRINKING WATER (OTHER THAN PACKAGED NATURAL MINERAL WATER)', 2016, 'Active', 'Food & Agriculture', 'FAD 14', 'Mandatory', 2022,
   null, 'Packaged drinking water including milk-adjacent pouch packaging references'],
  ['IS 9873 (Part 1):2019', 'SAFETY OF TOYS - PART 1: MECHANICAL AND PHYSICAL PROPERTIES', 2019, 'Active', 'Mechanical Engineering', 'MED 28', 'Mandatory', 2024,
   null, 'Mechanical and physical safety tests for children toys: no sharp edges, small parts choking hazards for under 3 years.'],
  ['IS 9873 (Part 2):2017', 'SAFETY OF TOYS - PART 2: FLAMMABILITY', 2017, 'Active', 'Mechanical Engineering', 'MED 28', 'Mandatory', 2023,
   null, 'Flammability safety requirements for toys.'],
  ['IS 9873 (Part 3):2017', 'SAFETY OF TOYS - PART 3: MIGRATION OF CERTAIN ELEMENTS', 2017, 'Active', 'Chemical Engineering', 'MED 28', 'Mandatory', 2023,
   null, 'Chemical toxicity limits: transferred Lead must be under 90 mg/kg, Cadmium under 75 mg/kg, Antimony under 60 mg/kg, Arsenic under 25 mg/kg.'],
];

const insertStd = db.prepare(`INSERT INTO standards (is_number, title, year, status, department, committee, mandatory_voluntary, reviewed_year, pdf_path, description) VALUES (?,?,?,?,?,?,?,?,?,?)`);
standards.forEach(s => insertStd.run(...s));

const manuals = [
  [1, 'IS 4151:2015', 'PROTECTIVE HELMET FOR TWO WHEELER RIDERS (Product Manual 2024)', 1.1, 'knowledge/pdfs/manuals/PM-IS-4151-helmet-2024.pdf'],
  [2, 'IS 623:2025', 'BICYCLES - BICYCLE FRAMES - SPECIFICATION (Product Manual 2024)', 0.5, 'knowledge/pdfs/manuals/PM-IS-623-bicycle-frame-2024.pdf'],
  [3, 'IS 3055 (Part 1):1994', 'Clinical Thermometers – Solid stem Type (Product Manual)', 0.2, 'knowledge/pdfs/manuals/PM-IS-3055-clinical-thermometer.pdf'],
  [4, 'IS 10613:2014', 'BICYCLE SAFETY REQUIREMENTS (Bilingual Product Manual)', 1.0, 'knowledge/pdfs/manuals/PM-IS-10613-bicycle-safety-bilingual.pdf'],
  [5, 'IS 269:2015', 'ORDINARY PORTLAND CEMENT — PRODUCT MANUAL 2023', 1.2, 'knowledge/pdfs/manuals/PM-IS-269-portland-cement-2023.pdf'],
];
const insertManual = db.prepare(`INSERT INTO product_manuals (sr_no, is_number, title, size_mb, pdf_path) VALUES (?,?,?,?,?)`);
manuals.forEach(m => insertManual.run(...m));

const fees = [
  ['IS 4151:2015', 'PROTECTIVE HELMET FOR TWO WHEELER RIDERS', 'Rs. 15,000 per annum', 'helmet,two wheeler,protective,4151'],
  ['IS 623:2025', 'BICYCLES - BICYCLE FRAMES', 'Rs. 12,000 per annum', 'cycle,bicycle,frame,623'],
  ['IS 3055 (Part 1):1994', 'Clinical Thermometers – Solid stem Type', 'Rs. 8,500 per annum', 'thermometer,clinical,3055'],
  ['IS 2062:2011', 'HOT ROLLED STRUCTURAL STEEL', 'Rs. 18,000 per annum', 'steel,structural,2062'],
  ['IS 15844:2010', 'SELF BALLASTED LED LAMPS', 'Rs. 10,000 per annum', 'led,lamp,lighting,15844,crs'],
];
const insertFee = db.prepare(`INSERT INTO marking_fees (is_number, title, fee_amount, keywords) VALUES (?,?,?,?)`);
fees.forEach(f => insertFee.run(...f));

// Process docs populated from real knowledge pack via sync-knowledge-into-clone.mjs

const referred = [
  ['IS 623:2025', 'IS 1068:2025', 'Zinc ingots (slab zinc) - Specification', 2025],
  ['IS 623:2025', 'IS 8910:2024', 'Cycles - Terminology', 2024],
  ['IS 623:2025', 'IS 10685:2024', 'Cycles - Safety requirements', 2024],
  ['IS 4151:2015', 'IS 2925:1984', 'Industrial safety helmets', 1984],
];
const insertRef = db.prepare(`INSERT INTO referred_standards (parent_is, referred_is, title, reviewed_year) VALUES (?,?,?,?)`);
referred.forEach(r => insertRef.run(...r));

const licences = [
  ['LIC-DEMO-4151', 'DEMO_MSME', 'Demo Helmets Pvt Ltd', 'IS 4151:2015', 'Two-wheeler helmets', 'Active', '2027-03-31'],
  ['LIC-DEMO-623', 'DEMO_MSME', 'Demo Cycles Industries', 'IS 623:2025', 'Bicycle frames', 'Active', '2027-06-30'],
  ['LIC-DEMO-3055', 'DEMO_MED', 'Demo MedTech Ltd', 'IS 3055 (Part 1):1994', 'Clinical thermometers', 'Suspended', '2026-12-31'],
];
const insertLic = db.prepare(`INSERT INTO licences (licence_number, org_id, company_name, is_number, product_name, status, valid_until) VALUES (?,?,?,?,?,?,?)`);
licences.forEach(l => insertLic.run(...l));

const applications = [
  ['BIS-APP-20250901001', 'Demo Helmets Pvt Ltd', 'IS 4151:2015', 'Two-wheeler helmets', 'Granted', '2025-09-01'],
  ['BIS-APP-20250915002', 'Demo Cycles Industries', 'IS 623:2025', 'Bicycle frames', 'Under Review', '2025-09-15'],
  ['BIS-APP-20250918003', 'Bengaluru Jewellers Association', 'Hallmarking', 'Gold jewellery hallmarking', 'Under Review', '2025-09-18'],
  ['BIS-APP-20250919004', 'Demo LED Works', 'IS 15844:2010', 'LED lamps (CRS)', 'Query Raised', '2025-09-19'],
];
const insertApp = db.prepare(`INSERT INTO applications (reference_id, company_name, is_number, product_name, status, submitted_at) VALUES (?,?,?,?,?,?)`);
applications.forEach(a => insertApp.run(...a));

const hallmarking = [
  ['AHC-BLR-001', 'BIS Assaying & Hallmarking Centre - Bengaluru', 'Bengaluru', 'Karnataka', 'Bengaluru Urban', 'AHC', 'Active', '080-22223333'],
  ['AHC-DEL-002', 'Delhi Gold Assaying Centre', 'New Delhi', 'Delhi', 'Central Delhi', 'AHC', 'Active', '011-23456789'],
  ['AHC-MUM-003', 'Mumbai Hallmarking Centre', 'Mumbai', 'Maharashtra', 'Mumbai City', 'AHC', 'Active', '022-34567890'],
  ['OFF-JAI-001', 'Jaipur Offsite AHC', 'Jaipur', 'Rajasthan', 'Jaipur', 'Offsite AHC', 'Active', '0141-2567890'],
  ['AHC-CHN-004', 'Chennai Assaying Centre', 'Chennai', 'Tamil Nadu', 'Chennai', 'AHC', 'Active', '044-26789012'],
  ['AHC-KOL-005', 'Kolkata Hallmarking Centre', 'Kolkata', 'West Bengal', 'Kolkata', 'AHC', 'Active', '033-27890123'],
];
const insertHm = db.prepare(`INSERT INTO hallmarking_centres (centre_id, name, city, state, district, centre_type, status, contact) VALUES (?,?,?,?,?,?,?,?)`);
hallmarking.forEach(h => insertHm.run(...h));

const labs = [
  ['LAB-NTH-PUNE-01', 'National Test House, Pune', 'Pune', 'Maharashtra', 'Group-1 Recognised', 'IS 2082 water heaters, electrical safety', 'IS 2082', 'ACCREDITED', 2, 'Recognised'],
  ['LAB-BIS-NR-01', 'BIS National Test House - Ghaziabad', 'Ghaziabad', 'Uttar Pradesh', 'Group-1 Recognised', 'Mechanical, chemical, electrical testing', 'IS 4151, IS 623', 'ACCREDITED', 4, 'Recognised'],
  ['LAB-BIS-SR-02', 'BIS Southern Regional Lab - Bengaluru', 'Bengaluru', 'Karnataka', 'Group-1 Recognised', 'Electronics, medical devices, textiles', 'IS 15844, IS 13252', 'ACCREDITED', 3, 'Recognised'],
  ['LAB-BIS-WR-03', 'BIS Western Regional Lab - Mumbai', 'Mumbai', 'Maharashtra', 'Group-1 Recognised', 'Chemical, petroleum, food products', 'IS 2062', 'ACCREDITED', 5, 'Recognised'],
  ['LAB-EMP-DEL-11', 'Delhi Empanelled Testing Lab Pvt Ltd', 'New Delhi', 'Delhi', 'Group-2 Empanelled', 'Helmets, protective equipment', 'IS 4151', 'ACCREDITED', 3, 'Empanelled'],
  ['LAB-EMP-CHN-12', 'Chennai Precision Testing Services', 'Chennai', 'Tamil Nadu', 'Group-2 Empanelled', 'Bicycle components, cycle frames', 'IS 623', 'ACCREDITED', 4, 'Empanelled'],
  ['LAB-EMP-KOL-13', 'Kolkata Metrology Lab', 'Kolkata', 'West Bengal', 'Group-2 Empanelled', 'Clinical thermometers, medical devices', 'IS 3055', 'ACCREDITED', 6, 'Empanelled'],
  ['LAB-EMP-HYD-14', 'Hyderabad Electronics Test Lab', 'Hyderabad', 'Telangana', 'Group-2 Empanelled', 'CRS electronics, LED lamps, IT equipment', 'IS 15844', 'ACCREDITED', 3, 'Empanelled'],
];
const insertLab = db.prepare(
  `INSERT INTO labs (lab_code, name, city, state, group_type, scope, capability, nabl_status, queue_time_weeks, status) VALUES (?,?,?,?,?,?,?,?,?,?)`
);
labs.forEach(l => insertLab.run(...l));

const consumer = [
  ['complaint-certified', 'Complaint against certified products', 'Complaints',
    'How to file a complaint when a BIS-certified product is defective or unsafe.',
    'complaint,certified,product,defect',
    `File a complaint with BIS Consumer Affairs when a product carrying the ISI / Standard Mark fails in use.

Steps:
1. Keep the invoice, product photograph, licence number on the mark, and a short description of the defect.
2. Submit the complaint through the BIS portal or the regional office that covers the manufacturer.
3. BIS acknowledges the complaint and may draw a sample for testing at a recognised laboratory.
4. If non-conformity is confirmed, BIS can issue a stop-marking order, require a recall, or start prosecution under the BIS Act.

Typical acknowledgement: 7 working days. Investigation timelines depend on lab queue and the Scheme of Inspection.`,
    'knowledge/pdfs/consumer/complaint-guidelines-certified-products-2023.pdf'],
  ['complaint-hallmarking', 'Complaint on hallmarking / purity', 'Hallmarking',
    'Report issues with hallmarking centres, jewellers, or gold purity marks (HUID).',
    'hallmarking,gold,purity,jeweller,complaint',
    `Consumers can verify a jewellery article using the 6-character HUID on the BIS Care app.

If purity, hallmark, or jeweller registration looks wrong:
1. Note the HUID, jeweller registration number, and invoice.
2. Lodge a complaint with the Assaying & Hallmarking Centre or BIS Hallmarking department.
3. BIS may send the article for independent assay. Confirmed under-karatage can lead to jeweller suspension.

Use the gold-testing guidelines PDF for sampling and assay procedure.`,
    'knowledge/pdfs/hallmarking/consumer-gold-testing-guidelines.pdf'],
  ['verify-is-mark', 'How to verify ISI / CRS mark', 'Awareness',
    'Steps to verify authenticity of ISI mark, CRS registration, and licence number on packaging.',
    'isi,crs,mark,verify,licence',
    `A genuine Standard Mark shows: ISI monogram (or CRS logo), licence / registration number (CM/L or R-), and IS number.

How to check:
1. Read the licence number on the product or packing.
2. Search it on the BIS / Manakonline licence status page.
3. Confirm the IS number matches the product type (e.g. helmets → IS 4151).
4. For electronics under CRS, look up the R-number on the MeitY CRS list.

Counterfeit marks often have wrong fonts, missing licence numbers, or an IS number that does not apply to that product.`,
    'knowledge/pdfs/manual/Guidelines.pdf'],
  ['consumer-rights', 'Consumer rights under BIS Act', 'Awareness',
    'Rights regarding mandatory certification, QCO compliance, and recall procedures.',
    'rights,consumer,bis act,mandatory',
    `Under the BIS Act, 2016 and Quality Control Orders:
• Products notified under a QCO cannot be manufactured, sold, or imported without a valid BIS licence / CRS registration.
• Consumers may demand a certified product where certification is mandatory (helmets, packaged water, many electrical goods).
• You may file a complaint and request independent lab testing of a certified article.
• BIS can order stop-marking, recall, and compounding of offences.

Keep bills and photos. Complaints without a licence number are still accepted if the mark is visible.`,
    'knowledge/pdfs/consumer/complaint-handling-procedure-ompc5.pdf'],
  ['lab-testing-consumer', 'Consumer product testing via labs', 'Labs',
    'How consumers or associations can approach recognised labs for independent product testing.',
    'lab,testing,consumer,sample',
    `Independent testing is done at BIS-recognised (Group-1) or empanelled (Group-2) laboratories.

1. Identify the IS number of the product.
2. Choose a lab whose scope lists that IS number (see the recognised-lab list).
3. Submit a sealed sample with chain-of-custody notes.
4. The lab issues a test report against the standard clauses (dimensions, safety, purity, etc.).

Lab queues vary (typically 2–6 weeks). NABL accreditation is shown on each lab record.`,
    'knowledge/pdfs/labs/group-1-recognised-labs-2026.pdf'],
];
const insertConsumer = db.prepare(
  `INSERT INTO consumer_topics (slug, title, category, summary, keywords, body, pdf_path) VALUES (?,?,?,?,?,?,?)`
);
consumer.forEach(c => insertConsumer.run(...c));

const qcos = [
  ['Steel (structural)', 'IS 2062:2011', 'SO 2357 (E)', '2020-08-15', 'Scheme-I (ISI Mark)', 'Metals', 'steel,structural,2062,qco', 'Ministry of Steel', 'QCO — Structural Steel'],
  ['Bicycle frames', 'IS 623:2025', 'QCO Bicycle DPIIT', '2025-01-01', 'Scheme-I (ISI Mark)', 'Transport', 'bicycle,cycle,frame,623,qco', 'DPIIT', 'Quality Control Order — Bicycles'],
  ['Two-wheeler helmets', 'IS 4151:2015', 'GSR 759(E)', '2018-06-01', 'Scheme-I (ISI Mark)', 'Automotive', 'helmet,two wheeler,4151,qco', 'Ministry of Road Transport and Highways', 'BIS Act / QCO helmets'],
  ['LED lamps', 'IS 15844:2010', 'CRS Notification 2012', '2012-10-03', 'Scheme-II (CRS)', 'Electronics', 'led,lamp,crs,15844,electronics', 'MeitY', 'Compulsory Registration Scheme'],
  ['IT equipment safety', 'IS 13252 (Part 1):2010', 'CRS Gazette 2012', '2012-10-03', 'Scheme-II (CRS)', 'Electronics', 'it equipment,crs,13252,electronics', 'MeitY', 'Compulsory Registration Scheme'],
  ['Clinical thermometers', 'IS 3055 (Part 1):1994', 'SO 822 (E)', '2019-04-01', 'Scheme-I (ISI Mark)', 'Medical', 'thermometer,clinical,3055,qco', 'Ministry of Health and Family Welfare', 'QCO — Clinical Thermometers'],
  ['Transformer stampings', 'IS 1180:2020', 'Extension Order 2024', '2024-12-01', 'Scheme-I (ISI Mark)', 'Electrical', 'transformer,stamping,lamination,qco', 'Ministry of Power', 'QCO extension'],
  ['Storage water heaters', 'IS 2082:2018', 'G.S.R. 182(E)', '2024-03-12', 'Scheme-I (ISI Mark)', 'Electrical Appliances', 'geyser,water heater,2082,qco', 'DPIIT', 'QCO — Storage Water Heaters (Mandatory)'],
  ['Packaged drinking water', 'IS 14543:2016', 'SO 14543-QCO', '2016-01-01', 'Scheme-I (ISI Mark)', 'Food & Water', 'water,packaged,14543,qco', 'Ministry of Consumer Affairs', 'QCO — Packaged Drinking Water'],
];
const insertQco = db.prepare(`INSERT INTO qco_orders (product, is_number, gazette_ref, effective_date, scheme, sector, keywords, ministry, legal_statute) VALUES (?,?,?,?,?,?,?,?,?)`);
qcos.forEach(q => insertQco.run(...q));

const sitManuals = [
  ['IS 4151:2015', 'SIT — Protective helmets (Scheme-I)', 'Scheme-I (ISI Mark)',
    'Impact absorption test rig; Penetration resistance cone; Chin-strap retention tester',
    'Daily drop-test log; Shell thickness checklist; Retention system inspection form',
    null,
    'Factory-floor testing matrix for two-wheeler helmet licence under Scheme-I.'],
  ['IS 623:2025', 'SIT — Bicycle frames (Scheme-I)', 'Scheme-I (ISI Mark)',
    'Frame fatigue test machine; Static load bench; Alignment gauge',
    'Weld inspection log; Fatigue cycle counter sheet; Dimensional verification form',
    null,
    'Operational STI for bicycle frame manufacturers seeking ISI mark.'],
  ['IS 2082:2018', 'SIT — Storage electric water heaters', 'Scheme-I (ISI Mark)',
    'Hydrostatic Pressure Rig (1.0 MPa / 15 min hold); High Voltage Dielectric Safety Tester (1500V AC); Insulation Resistance Meter / Megohmmeter (500V DC)',
    'Hydrostatic hold log (1.0 MPa / 15 min); Leakage observation sheet; Dielectric test pass/fail record',
    null,
    'Scheme of Inspection and Testing for geyser / storage water heater lines.'],
  ['IS 15844:2010', 'SIT — LED lamps (CRS / Scheme-II)', 'Scheme-II (CRS)',
    'Photometric integrating sphere; Electrical safety tester',
    'Batch photometric record; Safety test pass/fail sheet',
    null,
    'CRS-aligned factory tests for self-ballasted LED lamps.'],
];
const insertSit = db.prepare(`INSERT INTO sit_manuals (is_number, title, scheme, testing_machinery, daily_log_template, pdf_path, summary) VALUES (?,?,?,?,?,?,?)`);
sitManuals.forEach(s => insertSit.run(...s));

const synonyms = [
  ['geyser', 'water heater,storage electric water heater,IS 2082', 'IS 2082:2018', 'Colloquial for storage water heater'],
  ['helmet', 'protective helmet,two wheeler helmet,IS 4151', 'IS 4151:2015', null],
  ['milk packet', 'polyethylene flexible pouches,pasteurized milk', null, 'Trade name → packaging standard jargon'],
  ['milk plastic packet', 'polyethylene flexible pouches for packing of pasteurized milk', null, null],
  ['boiled water', 'packaged drinking water,IS 14543', 'IS 14543:2016', null],
  ['gold ring', 'hallmarking,HUID,precious metals', null, 'Consumer hallmarking path'],
  ['kharcha', 'marking fee,licence fee,application fee', null, 'Hinglish cost query'],
  ['nakli', 'counterfeit,fake ISI,fake mark', null, null],
  ['shudhata', 'purity,carat purity,fineness', null, null],
  ['cycle', 'bicycle,bicycle frame,IS 623', 'IS 623:2025', null],
  ['led bulb', 'LED lamps,IS 15844,CRS', 'IS 15844:2010', null],
  ['steel rod', 'structural steel,IS 2062', 'IS 2062:2011', null],
];
const insertSyn = db.prepare(`INSERT INTO layman_synonyms (colloquial, formal_terms, is_number, notes) VALUES (?,?,?,?)`);
synonyms.forEach(s => insertSyn.run(...s));

const today = new Date().toISOString().slice(0, 10);
const newsItems = [
  ['Extension of amendments to Indian Standards', 'BIS has extended the effective date for selected amendments under Scheme-I.', today, 'Standards', '/news'],
  ['Webinar on Technical Regulation Portal', 'Open session for MSMEs on using the BIS technical regulation portal.', today, 'Events', '/news'],
  ['Updated product manuals published', 'Product manuals for helmet, bicycle frame and clinical thermometer updated on the portal.', today, 'Certification', '/news'],
  ['Mandatory hallmarking expanded to 256 districts', 'Phase-wise mandatory hallmarking now covers additional districts as per latest order.', today, 'Hallmarking', '/news'],
  ['CRS registration deadline for LED lamps', 'Manufacturers of self-ballasted LED lamps must complete CRS registration by notified date.', today, 'CRS', '/news'],
  ['New QCO on structural steel enforcement', 'Quality Control Order for hot rolled structural steel IS 2062 now in force.', today, 'QCO', '/news'],
  ['Lab recognition scheme 2026 list published', 'Updated list of Group-1 recognised and Group-2 empanelled laboratories released.', today, 'Labs', '/news'],
];
const insertNews = db.prepare(
  `INSERT INTO news (title, summary, published_at, category, source_url) VALUES (?,?,?,?,?)`
);
newsItems.forEach(n => insertNews.run(...n));

const feeStructures = [
  ['IS 2082:2018', 'micro_msme', 50000, 0.50, 4, 'Simplified Procedure', '50% MSME discount on marking fees; 4-week processing'],
  ['IS 2082:2018', 'small_msme', 50000, 0.25, 6, 'Simplified Procedure', '25% MSME discount'],
  ['IS 2082:2018', 'large', 50000, 0, 8, 'Normal Procedure', 'Standard 8-week timeline'],
  ['IS 4151:2015', 'micro_msme', 15000, 0.50, 4, 'Simplified Procedure', 'Helmet MSME pathway'],
  ['IS 4151:2015', 'large', 15000, 0, 8, 'Normal Procedure', 'Standard helmet certification'],
];
const insertFeeStruct = db.prepare(
  `INSERT INTO fee_structures (is_number, enterprise_type, marking_fee, msme_discount, processing_weeks, procedure_name, notes) VALUES (?,?,?,?,?,?,?)`
);
feeStructures.forEach(f => insertFeeStruct.run(...f));

const guidance = [
  ['variant-scope-inclusion', 'Variant Scope Inclusion (Endorsement) Guidelines', 'Certification',
    'Under BIS regulatory guidelines, manufacturers with an active licence may perform Variant Scope Inclusion (Endorsement) under the existing licence number. This bypasses an initial factory audit completely. Applies when adding a new shell size, voltage variant, or capacity within the same IS standard scope. Citation: BIS Operations Manual, Chapter 4, Section 4.2.',
    'variant,endorsement,inclusion,scope,helmet,size'],
  ['simplified-procedure-msme', 'Simplified Certification Procedure for MSMEs', 'Process',
    'Micro and small enterprises registered under Udyam qualify for the Simplified Procedure: reduced processing time (4 weeks vs 8 weeks), 50% marking fee discount, and streamlined factory inspection scheduling.',
    'msme,udyam,simplified,startup,small'],
];
const insertGuidance = db.prepare(
  `INSERT INTO regulatory_guidance (slug, title, category, content, keywords) VALUES (?,?,?,?,?)`
);
guidance.forEach(g => insertGuidance.run(...g));

const inspections = [
  ['IS 4151:2015', 'drop-log', 'Are daily impact drop-test logs signed for this week?', 1, 'Clause 6.1'],
  ['IS 4151:2015', 'shell-thickness', 'Is shell thickness verification recorded for each production batch?', 1, 'Clause 5.3'],
  ['IS 4151:2015', 'retention-system', 'Is chin-strap retention system inspection completed per shift?', 1, 'Clause 6.2'],
  ['IS 4151:2015', 'sensor-calibration', 'Are impact sensors calibrated to current Clause 4.2.1 deceleration limits (250g max)?', 1, 'Clause 4.2.1'],
  ['IS 4151:2015', 'vertex-drop-mass', 'Is vertex drop mass configuration scaled for larger shell variant per Clause 6.1?', 1, 'Clause 6.1'],
  ['IS 2082:2018', 'hydrostatic-log', 'Are hydrostatic pressure test logs (1.0 MPa / 15 min) complete for this week?', 1, 'SIT 3.1'],
  ['IS 2082:2018', 'dielectric-test', 'Is dielectric strength test (1500V AC) recorded for each batch?', 1, 'SIT 3.2'],
  ['IS 2082:2018', 'grounding-records', 'Are high-voltage grounding safety records signed for this week?', 1, 'SIT 3.3'],
];
const insertInspection = db.prepare(
  `INSERT INTO inspection_checklists (is_number, check_id, question, critical, clause_ref) VALUES (?,?,?,?,?)`
);
inspections.forEach(i => insertInspection.run(...i));

// FMCS Catalog — HS Code to IS Number mapping
const fmcsCatalog = [
  ['8542.31', 'Automotive Engine Control Units (ECU)', 'IS 16046 (Part 2):2018', 'FMCS (Scheme-I)', 1, 'Automotive Electronics', 'ECUs and automotive electronics require FMCS BIS license before India import'],
  ['8541.40', 'LED light-emitting diodes and LED lamps', 'IS 15844:2010', 'CRS (Scheme-II)', 1, 'Electronics', 'CRS mandatory registration via MeitY portal'],
  ['8471.30', 'Portable information technology equipment', 'IS 13252 (Part 1):2010', 'CRS (Scheme-II)', 1, 'Electronics', 'IT equipment safety — CRS registration mandatory'],
  ['8516.10', 'Electric instantaneous or storage water heaters', 'IS 2082:2018', 'FMCS (Scheme-I)', 1, 'Electrical Appliances', 'FMCS mandatory — ISI mark required before customs clearance'],
  ['8517.13', 'Smartphones and mobile handsets', 'IS 13252 (Part 1):2010', 'CRS (Scheme-II)', 1, 'Electronics', 'Mandatory CRS registration for all mobile handsets'],
  ['7216.10', 'Hot-rolled structural steel sections', 'IS 2062:2011', 'FMCS (Scheme-I)', 1, 'Metals', 'Structural steel QCO — BIS FMCS license required for import'],
  ['6506.10', 'Safety helmets', 'IS 4151:2015', 'FMCS (Scheme-I)', 1, 'Safety Equipment', 'Two-wheeler helmets require FMCS license for import'],
  ['8714.91', 'Bicycle frames', 'IS 623:2025', 'FMCS (Scheme-I)', 1, 'Transport', 'Bicycle frame QCO — FMCS mandatory'],
  ['8481.80', 'Pressure relief valves and plumbing fittings', 'IS 778:2019', 'FMCS (Scheme-I)', 1, 'Plumbing', 'Safety critical plumbing components — FMCS'],
  ['9018.19', 'Clinical thermometers', 'IS 3055 (Part 1):1994', 'FMCS (Scheme-I)', 1, 'Medical Devices', 'Medical device FMCS requirement'],
  ['8504.40.90', 'Static converters / power inverters', 'IS 13252 (Part 1):2010', 'FMCS (Scheme-I)', 1, 'Electronics', 'Port enforcement mandate — mandatory BIS clearance before customs release'],
  ['8516.79', 'Domestic induction cooking appliances (import)', 'IS DEMO 1003:2025', 'FMCS (Scheme-I)', 1, 'Electrical Appliances', 'FMCS-DEMO-003 | QCO-DEMO-003 | AIR required | Factory inspection | BIS lab test reports'],
];
const insertFmcsCatalog = db.prepare(
  `INSERT INTO fmcs_catalog (hs_code, product_description, is_number, scheme, mandatory_import, sector, notes) VALUES (?,?,?,?,?,?,?)`
);
fmcsCatalog.forEach(f => insertFmcsCatalog.run(...f));

// FMCS Applications — demo foreign tracking records
const fmcsApplications = [
  ['FMCS-DE-88301', 'AutoElektronik GmbH', 'Germany', 'Berlin Industrial Park, Siemensstraße 15, 10627 Berlin', 'Sharma & Associates LLP', '42 Parliament Street, New Delhi 110001', 'IS 16046 (Part 2):2018', 'Automotive ECU', 'Under Review'],
  ['FMCS-JP-44102', 'Tokyo LED Industries Co Ltd', 'Japan', 'Osaka Tech Zone, Osaka 530-0011', 'CRS India Pvt Ltd', 'Bengaluru Tech Park, Bengaluru 560001', 'IS 15844:2010', 'LED Lamps', 'Granted'],
  ['FMCS-KR-55203', 'Samsung IT Korea', 'South Korea', 'Seoul Digital Complex, Guro-gu, Seoul', 'Korea India Trade Bridge LLP', 'Mumbai, Maharashtra 400001', 'IS 13252 (Part 1):2010', 'IT Equipment', 'Granted'],
];
const insertFmcsApp = db.prepare(
  `INSERT INTO fmcs_applications (reference_id, company_name, country_of_origin, factory_address, air_name, air_address, is_number, product_name, status) VALUES (?,?,?,?,?,?,?,?,?)`
);
fmcsApplications.forEach(a => insertFmcsApp.run(...a));

// FMCS Fee Matrix — international cost structures with travel zones
const fmcsFees = [
  ['IS 15844:2010', 'CRS (Scheme-II)', 14500, 'Zone Asia', 800, 870, 12, 'Zone Asia covers East Asia, Southeast Asia. CRS online registration, no factory visit required.'],
  ['IS 15844:2010', 'CRS (Scheme-II)', 14500, 'Zone Europe', 2500, 2720, 16, 'Zone Europe covers EU, UK, Switzerland. Factory audit required for Scheme-I escalation.'],
  ['IS 13252 (Part 1):2010', 'CRS (Scheme-II)', 14500, 'Zone Asia', 800, 870, 12, 'CRS registration for IT equipment — Asia zone.'],
  ['IS 13252 (Part 1):2010', 'CRS (Scheme-II)', 14500, 'Zone Europe', 2500, 2720, 16, 'CRS registration for IT equipment — Europe zone.'],
  ['IS 2082:2018', 'FMCS (Scheme-I)', 30000, 'Zone Europe', 2500, 2720, 20, 'Zone Europe — BIS officer flies to factory. Statutory ₹30,000 + officer travel €2,500 (flight, lodging, daily allowance).'],
  ['IS 2082:2018', 'FMCS (Scheme-I)', 30000, 'Zone Asia', 800, 870, 16, 'Zone Asia — lower travel overhead.'],
  ['IS 2082:2018', 'FMCS (Scheme-I)', 30000, 'Zone Americas', 3200, 3200, 24, 'Zone Americas — highest travel cost tier.'],
  ['IS 16046 (Part 2):2018', 'FMCS (Scheme-I)', 30000, 'Zone Europe', 2500, 2720, 20, 'Automotive ECU — FMCS Scheme-I. Officer audit at German plant.'],
  ['IS 4151:2015', 'FMCS (Scheme-I)', 30000, 'Zone Europe', 2500, 2720, 20, 'FMCS helmets from Europe.'],
  ['IS 2062:2011', 'FMCS (Scheme-I)', 30000, 'Zone Europe', 2500, 2720, 20, 'Structural steel import FMCS — Zone Europe.'],
];
const insertFmcsFee = db.prepare(
  `INSERT INTO fmcs_fee_matrix (is_number, scheme, application_fee_inr, travel_zone, travel_fee_eur, travel_fee_usd, processing_weeks, notes) VALUES (?,?,?,?,?,?,?,?)`
);
fmcsFees.forEach(f => insertFmcsFee.run(...f));

// Treaty Registry — MRA and bilateral agreements
const treaties = [
  ['Germany', 'Indo-German Technical Cooperation Agreement', 'MRA', 'Electronics,Automotive,Electrical Appliances', 'IS 16046,IS 15844,IS 13252', 1, 0, '2018-01-01', 'European lab reports from DAkkS-accredited labs accepted for CRS/FMCS initial testing phase. Physical audit still required for Scheme-I.'],
  ['European Union', 'EU-India FTA Technical Annex', 'MRA', 'Electronics,Automotive,Safety Equipment', 'IS 15844,IS 13252,IS 4151', 1, 0, '2020-03-15', 'EU CE-marked products with equivalent safety testing may submit EU test reports in lieu of Indian lab tests. Saves 4 weeks.'],
  ['Japan', 'India-Japan CEPA — Technical Standards Annex', 'CEPA', 'Electronics,Automotive', 'IS 15844,IS 13252', 1, 1, '2011-08-01', 'CEPA 2011 — JIS-aligned test reports accepted. Factory audit waived for electronics if JIS certificate provided.'],
  ['South Korea', 'India-Korea CEPA — Standards Chapter', 'CEPA', 'Electronics,Automotive', 'IS 15844,IS 13252', 1, 1, '2010-01-01', 'KC-marked products with conformity documentation: testing waiver applicable. Audit waiver for CRS electronics only.'],
  ['United Kingdom', 'India-UK FTA Standards Protocol', 'FTA', 'Electrical Appliances,Safety Equipment', 'IS 2082,IS 4151', 1, 0, '2023-06-01', 'UKAS-accredited test reports accepted for FMCS initial submission. Statutory audit still required.'],
  ['United States', 'No active MRA', 'None', '', '', 0, 0, null, 'No bilateral MRA currently in force. Full FMCS process applies including independent Indian lab testing.'],
];
const insertTreaty = db.prepare(
  `INSERT INTO treaty_registry (country, agreement_name, agreement_type, sectors_covered, is_numbers_covered, testing_waiver, audit_waiver, effective_date, notes) VALUES (?,?,?,?,?,?,?,?,?)`
);
treaties.forEach(t => insertTreaty.run(...t));

// Additional regulatory_guidance rows for FMCS
const fmcsGuidance = [
  ['fmcs-air-nomination', 'AIR Nomination — Authorized Indian Representative (Form-VI)', 'FMCS',
    `Under the Foreign Manufacturers Certification Scheme (FMCS), every foreign entity must appoint an Authorized Indian Representative (AIR) who is an Indian citizen residing in India. The AIR holds legal responsibility for product quality in India on behalf of the foreign manufacturer.

FORM-VI POWER OF ATTORNEY TEMPLATE — Required clauses:
1. "I/We [Foreign Company Name], incorporated under [Country] laws, hereby appoint [AIR Full Name], Indian national, residing at [AIR Address], as our Authorized Indian Representative (AIR) under the BIS Foreign Manufacturers Certification Scheme."
2. "The AIR is empowered to: apply for and hold BIS licenses on our behalf; respond to BIS communications; accept service of legal notices; coordinate factory inspections; and ensure ongoing compliance with IS [standard number]."
3. "This Power of Attorney shall remain valid until revoked in writing. The AIR accepts all liabilities arising from product non-conformance sold in India under our brand."
4. Execute on company letterhead, notarize in the country of origin, and apostille if applicable.
5. Submit original with Form-I application to BIS FMCS Cell, New Delhi.

Citation: BIS FMCS Scheme Rules 2018, Clause 7.3.`,
    'AIR,authorized indian representative,form-VI,power of attorney,FMCS,foreign manufacturer'],

  ['fmcs-inspector-travel', 'BIS Inspector Hosting Guidelines for Overseas Factory Audits', 'FMCS',
    `When BIS deputes an inspection team for an overseas factory audit under FMCS, the foreign manufacturer (applicant) must arrange the following logistics at their own cost:

VISA & DOCUMENTATION:
- Issue a formal business visa invitation letter within 5 working days of BIS confirmation.
- The letter must be on company letterhead and specify factory address, audit duration (typically 3–5 days), and names of the hosting personnel.

FLIGHT:
- Provide economy class tickets for BIS officers up to Scientist-C grade.
- Business class for Scientist-E and above on routes exceeding 6 hours flight time.
- Book tickets at least 15 days in advance to allow BIS approval.

ACCOMMODATION:
- Arrange 4-star or 5-star hotel accommodation within 10 km of the factory.
- Per diem: BIS pays its own daily allowance per GFR rules; the host covers room only.
- Ensure vegetarian meal options are available at the hotel.

FACTORY-SIDE REQUIREMENTS:
- Assign a dedicated factory liaison officer fluent in English.
- All machinery and test equipment must be operational on audit days.
- Pre-audit documentation package (quality manual, test records for last 3 batches) submitted 7 days before visit.

Citation: BIS FMCS Administrative Guidelines 2022, Section 9.`,
    'inspector,travel,logistics,visa,hotel,factory audit,overseas,BIS officer hosting'],

  ['fmcs-lifecycle', 'FMCS Certification Lifecycle — Step by Step', 'FMCS',
    `The Foreign Manufacturers Certification Scheme (FMCS) follows a strict 6-stage lifecycle:

STAGE 1 — NOMINATION (Week 1–2):
Appoint an Authorized Indian Representative (AIR) and execute Form-VI Power of Attorney. The AIR submits the application online at the BIS portal.

STAGE 2 — DOCUMENT SCREENING (Week 3–4):
BIS FMCS Cell reviews: factory registration certificate, quality manual, previous test reports, AIR appointment letter, application fee payment (₹30,000).

STAGE 3 — FACTORY AUDIT (Week 5–16 depending on travel zone):
BIS officer deputed to foreign plant. Duration: 3–5 working days. Items inspected: production line, SIT machinery, QC records, calibration certificates.

STAGE 4 — SAMPLE EXTRACTION (Week 16–18):
Inspector draws product samples during factory audit. Samples shipped to BIS-recognized Indian laboratory under sealed custody.

STAGE 5 — INDIAN LAB TESTING (Week 18–22):
Laboratory tests samples against the relevant IS standard. Test report issued.

STAGE 6 — LICENSE GRANT (Week 22–24):
If testing passes: BIS grants FMCS license valid for 1–2 years. License number printed on product or packaging for Indian customs clearance.

For countries with active MRA/CEPA: Stage 4 (Indian lab testing) may be waived if equivalent foreign test reports are accepted. Saves 4–6 weeks.

Citation: BIS FMCS Scheme Document 2018 (as amended 2022).`,
    'FMCS,lifecycle,steps,foreign,certification,timeline,roadmap'],
];
const insertFmcsGuidance = db.prepare(
  `INSERT INTO regulatory_guidance (slug, title, category, content, keywords) VALUES (?,?,?,?,?)`
);
fmcsGuidance.forEach(g => insertFmcsGuidance.run(...g));

// Additional layman synonyms for foreign exporter context
const exporterSynonyms = [
  ['ECU', 'engine control unit,automotive electronics,IS 16046,FMCS', 'IS 16046 (Part 2):2018', 'Automotive ECU export context'],
  ['FMCS', 'foreign manufacturers certification scheme,import license,BIS foreign', null, 'Foreign certification scheme'],
  ['AIR', 'authorized indian representative,India agent,local representative,Form-VI', null, 'FMCS legal representative requirement'],
  ['CRS', 'compulsory registration scheme,MeitY,electronics registration,IS 15844,IS 13252', null, 'Electronics import via CRS'],
  ['MRA', 'mutual recognition agreement,bilateral trade treaty,test waiver,CEPA', null, 'Trade treaty abbreviation'],
  ['customs clearance', 'import license,BIS license,port clearance,IS mandatory', null, 'Import compliance context'],
  ['Chennai port', 'import compliance,customs,BIS mandatory,port clearance', null, 'Port of entry context'],
  ['LED import', 'LED lamps,CRS,IS 15844,MeitY registration,import mandatory', 'IS 15844:2010', null],
];
const insertExporterSyn = db.prepare(
  `INSERT INTO layman_synonyms (colloquial, formal_terms, is_number, notes) VALUES (?,?,?,?)`
);
exporterSynonyms.forEach(s => insertExporterSyn.run(...s));

// Additional news items for foreign exporter context
const exporterNews = [
  ['CRS registration mandatory for all imported IT equipment', 'MeitY has notified that all imported IT equipment under IS 13252 must complete CRS registration before customs clearance. Effective immediately for new shipments.', today, 'CRS', '/news'],
  ['FMCS license renewal: Annual audit schedule published', 'BIS has published the factory audit schedule for FMCS renewal applicants. Foreign manufacturers must respond within 30 days.', today, 'FMCS', '/news'],
  ['Bilateral MRA with European Union expanded to include safety equipment', 'India-EU Technical Cooperation Agreement now covers IS 4151 helmets and IS 2082 water heaters, allowing EU test reports for FMCS applications.', today, 'MRA', '/news'],
  ['Customs detention notice: Structural steel imports without IS 2062 FMCS license', 'Customs at JNPT Mumbai detaining shipments of structural steel lacking valid IS 2062 FMCS license. Importers must secure licenses before departure.', today, 'Enforcement', '/news'],
];
exporterNews.forEach(n => insertNews.run(...n));

db.prepare(
  `INSERT INTO standard_fingerprints (domain, fingerprint) VALUES (?, ?)`
).run('standards', 'baseline-is-4151-2015-v1');

db.prepare(
  `INSERT INTO marking_fees (is_number, title, fee_amount, keywords) VALUES (?,?,?,?)`
).run('IS 2082:2018', 'STATIONARY STORAGE TYPE ELECTRIC WATER HEATERS', 'Rs. 50,000 per annum', 'geyser,water heater,2082,kharcha');

// ==========================================
// EVERYDAY CITIZEN DEMO DATA SEEDING
// ==========================================

// 1. Mock Standards Catalog (IS 9873 Toy Safety Parts 1, 2, 3)
const standardsCatalog = [
  ['IS 9873 (Part 1):2019', 'Safety of Toys - Part 1: Mechanical and Physical Properties', 'Part 1', 'Mechanical and physical safety tests: sharp points, sharp edges, small parts posing choking hazards for children under 3 years.', 'No sharp edges or small parts that pose choking hazards.', 'N/A (Mechanical Safety)', 0, 0, 'Mandatory', '2021-01-01'],
  ['IS 9873 (Part 2):2017', 'Safety of Toys - Part 2: Flammability', 'Part 2', 'Flammability test for textile/pile toys and play costumes.', 'Self-extinguishing materials; flame spread rate limit', 'N/A (Flammability)', 0, 0, 'Mandatory', '2021-01-01'],
  ['IS 9873 (Part 3):2017', 'Safety of Toys - Part 3: Migration of Certain Elements', 'Part 3', 'Chemical toxicity and heavy metal migration limits from toy materials.', 'Mechanical and chemical boundaries', 'Maximum allowable transferred Lead must be under 90 mg/kg, and Cadmium must be under 75 mg/kg. Antimony < 60 mg/kg, Arsenic < 25 mg/kg, Barium < 1000 mg/kg, Chromium < 60 mg/kg, Mercury < 60 mg/kg, Selenium < 500 mg/kg.', 90.0, 75.0, 'Mandatory', '2021-01-01'],
];
const insertCatalog = db.prepare(
  `INSERT INTO mock_standards_catalog (is_number, title, part, scope, mechanical_safety, chemical_limits, lead_limit_mg_kg, cadmium_limit_mg_kg, qco_status, effective_date)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
);
standardsCatalog.forEach(c => insertCatalog.run(...c));

// 2. Mock Grievances (Consumer complaint intake & progress tracking)
const grievances = [
  ['CON-GRP-4401', 'Rajesh Kumar', '+91-9876543210', 'rajesh.consumer@gmail.com', 'PowerSafe Retail Electronics', 'Electrical Accessories', 'High-Power Surge Extension Board (4-Socket)', 'IS 1293:2019', 'INV-2026-8821', 'store_bill_invoice_2026_8821.pdf', 'My new extension board caught fire this morning while charging my phone. I have the store bill. Can you file an official complaint against this brand for me?', 'OFFICER_ASSIGNED', 'Surprise sample collection ordered', 'S. N. Verma (Senior Enforcement Officer, BIS Northern Region)', 'A BIS field enforcement officer has been officially assigned to pull retail samples of this batch within 48 hours.', '2026-09-19 09:30:00', '2026-09-20 08:45:00'],
];
const insertGrievance = db.prepare(
  `INSERT INTO mock_grievances (ticket_id, consumer_name, consumer_phone, consumer_email, merchant_name, product_category, product_name, is_number, invoice_number, evidence_upload, complaint_details, status, action, officer_name, officer_notes, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);
grievances.forEach(g => insertGrievance.run(...g));

// 3. Mock QCO Registry (Statutory citations and merchant dispute leverage)
const qcoRegistry = [
  ['IS 2082:2018', 'Stationary storage type electric water heaters (Geysers)', 'G.S.R. 182(E)', 'Ministry of Commerce and Industry (DPIIT)', 'Section 16 & Section 17, Bureau of Indian Standards Act, 2016', 'Under Ministry QCO Gazetted Order G.S.R. 182(E), selling an uncertified geyser under IS 2082 is a criminal offense punishable under Section 29 of BIS Act 2016 with imprisonment up to 2 years or fine not less than ₹2,00,000.', 'Show the merchant this official citation: Under Ministry QCO Gazetted Order G.S.R. 182(E), selling an uncertified geyser under IS 2082 is a criminal offense. Inform them that if a refund is not issued, you will immediately upload this store bill to the BIS mobile enforcement application for immediate shop sealing.', '2024-03-12'],
  ['IS 9873 (Part 1):2019', 'Safety of Toys', 'S.O. 853(E) Toys (Quality Control) Order', 'DPIIT', 'Section 16, BIS Act 2016', 'Toys QCO 2020: Manufacturing, importing, distributing, or selling uncertified toys lacking ISI mark is a cognizable offense.', 'Under Toys QCO S.O. 853(E), all children toys must bear ISI mark under Scheme-I. Selling uncertified plastic toys is punishable with immediate stock confiscation and shop sealing.', '2021-01-01'],
  ['IS 4151:2015', 'Protective Helmets for Two-Wheeler Riders', 'G.S.R. 759(E)', 'Ministry of Road Transport and Highways', 'Section 129 Motor Vehicles Act & BIS Act 2016', 'Manufacture, storage, sale, or import of non-ISI helmets is completely prohibited nationwide. Retail shops selling fake or non-BIS helmets face criminal prosecution.', 'Under MoRTH Gazette G.S.R. 759(E), selling non-ISI helmets is illegal. Retailers are legally bound to accept returns of non-compliant helmets.', '2019-01-15'],
];
const insertQcoReg = db.prepare(
  `INSERT INTO mock_qco_registry (is_number, product, gazette_ref, ministry, legal_statute, penal_clause, dispute_leverage_text, effective_date)
   VALUES (?,?,?,?,?,?,?,?)`
);
qcoRegistry.forEach(q => insertQcoReg.run(...q));

// 4. Mock Licensed Manufacturers (Deterministic counterfeit verification)
const licensedManufacturers = [
  ['4151999', 'CM/L-4151999', 'FakeArmor Helmets', 'FakeArmor Helmets', 'EXPIRED_OPERATIONS', 'IS 4151:2015', 'Protective Helmets for Two-Wheeler Riders', '2025-01-15', 'License cancelled due to non-conformance with Clause 4.2.1 shock absorption requirements and unauthorized marking.', 'COUNTERFEIT WARNING ❌ License number CM/L-4151999 is flagged as INVALID/EXPIRED. It belonged to an entity named FakeArmor Helmets whose license was canceled last year. Do not buy this product; it is an illegal safety risk.'],
  ['7200192', 'CM/L-7200192', 'Steelbird Hi-Tech India Ltd', 'Steelbird Hi-Tech India Ltd', 'ACTIVE_OPERATIONS', 'IS 4151:2015', 'Protective Helmets for Two-Wheeler Riders', '2027-12-31', null, 'GENUINE LICENSE ✅ License number CM/L-7200192 is ACTIVE and verified for Steelbird Hi-Tech India Ltd under IS 4151:2015.'],
  ['8100234', 'CM/L-8100234', 'Bajaj Electricals Ltd', 'Bajaj Electricals Ltd', 'ACTIVE_OPERATIONS', 'IS 2082:2018', 'Storage Electric Water Heaters', '2028-06-30', null, 'GENUINE LICENSE ✅ License number CM/L-8100234 is ACTIVE and verified for Bajaj Electricals Ltd under IS 2082:2018.'],
  ['8830112', 'CM/L-8830112', 'Delta Pressure Vessels Pvt Ltd', 'Delta Pressure Vessels Pvt Ltd', 'SUSPENDED', 'IS 2082:2018', 'Storage Electric Water Heaters', '2026-02-01', 'Failed inline pressure safety audits on hydrostatic test rigs.', 'STATUS ALERT: ENFORCEMENT HOLD 🚨 License CM/L-8830112 is SUSPENDED due to failed audit on inline safety setups. Any goods manufactured after last month are illegal for market release.'],
];
const insertLicensedMfr = db.prepare(
  `INSERT INTO mock_licensed_manufacturers (cml_number, licence_number, factory, company_name, status, is_number, product, valid_until, cancellation_reason, risk_assessment)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
);
licensedManufacturers.forEach(m => insertLicensedMfr.run(...m));

// 5. Mock Hazard Alerts (High-priority public health warnings)
const hazardAlerts = [
  ['HAZ-8802', 'Baby feeding bottles', 'IS 14625:2015 / IS 5168', 'Toxic Industrial Plastic / Chemical Toxicity', 'critical', 'Local retail store / unbranded market', 'This local store is selling cheap unbranded baby feeding bottles that smell intensely like toxic industrial plastic.', 'DISPATCHED_ENFORCEMENT', '["Regional Enforcement Cell", "Regulator Control Desk", "Rapid Retail Testing Squad"]', '2026-09-20 11:15:00'],
];
const insertHazard = db.prepare(
  `INSERT INTO mock_hazard_alerts (hazard_id, product_name, is_number, hazard_category, severity, store_location, report_text, status, notified_cells, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
);
hazardAlerts.forEach(h => insertHazard.run(...h));

// 6. Bilingual Consumer Rights (Regional language localization)
const bilingualRights = [
  ['gold_hallmarking', 'hi', 'स्वर्ण आभूषण हॉलमार्किंग अधिकार', 'स्वर्ण आभूषण खरीदते समय 3 प्रमुख पहचान बिंदु', '["BIS त्रिकोणीय लोगो: शुद्ध असली हॉलमार्क की पहली पहचान है।", "प्यूरिटी ग्रेड: जैसे 22K916 का मतलब है 22 कैरेट शुद्ध सोना।", "HUID कोड: गहने पर लेज़र से छपा हुआ 6 अंकों का अल्फ़ान्यूमेरिक ट्रैकिंग नंबर ज़रूर देखें।"]', `स्वर्ण आभूषण खरीदते समय इन बातों का ध्यान रखें:\n1. BIS त्रिकोणीय लोगो: शुद्ध असली हॉलमार्क की पहली पहचान है।\n2. प्यूरिटी ग्रेड: जैसे 22K916 का मतलब है 22 कैरेट शुद्ध सोना।\n3. HUID कोड: गहने पर लेज़र से छपा हुआ 6 अंकों का अल्फ़ान्यूमेरिक ट्रैकिंग नंबर ज़रूर देखें।`],
  ['gold_hallmarking', 'en', 'Gold Hallmarking Consumer Rights', 'Three core verification steps when buying gold jewellery', '["BIS Triangular Logo: Primary mark of authentic hallmarking.", "Purity Grade: e.g. 22K916 denotes 22 carat pure gold.", "6-digit HUID Code: Unique alphanumeric laser-etched tracking identifier."]', `When buying gold jewellery, verify these 3 mandatory marks:\n1. BIS Triangular Logo: Primary mark of authentic hallmarking.\n2. Purity Grade: e.g. 22K916 denotes 22 carat pure gold.\n3. HUID Code: 6-digit alphanumeric laser-etched tracking identifier.`],
];
const insertBilingual = db.prepare(
  `INSERT INTO bilingual_consumer_rights (topic, lang, title, summary, points_json, formatted_text)
   VALUES (?,?,?,?,?,?)`
);
bilingualRights.forEach(b => insertBilingual.run(...b));

// 7. Additional layman synonyms for electronics & consumer jargon
const citizenSynonyms = [
  ['2000V Dielectric High-Voltage Insulation test', 'dielectric breakdown,insulation resistance,safety barrier,IS 302', 'IS 302-2-30', 'Shock-proof safety barrier: heater internal wiring has a heavy-duty protective shield so electricity cannot leak into outer metal casing even under 2000V surge'],
  ['2000V Dielectric High-Voltage Insulation', 'dielectric strength,high voltage barrier,insulation resistance', 'IS 302-2-30', 'Shock-proof safety barrier preventing electrical leakage into outer metal casing'],
  ['Dielectric Insulation Resistance', 'dielectric strength,high-voltage barrier,insulation resistance', 'IS 302-2-30', 'Shock-proof safety barrier'],
  ['Dielectric breakdown insulation resistance thresholds must exceed 2000V', 'dielectric breakdown,insulation resistance,safety barrier', 'IS 302-2-30', 'Heavy-duty insulation barrier protecting user from shock hazards'],
  ['plastic toys', 'IS 9873,toy safety,choking hazard,lead cadmium limits', 'IS 9873 (Part 1):2019', 'Toy safety and toxicity regulation'],
  ['extension board', 'IS 1293,plugs and sockets,fire safety,extension cord', 'IS 1293:2019', 'Electrical extension board'],
];
citizenSynonyms.forEach(s => insertSyn.run(...s));

// Persona 5 — Gold Buyers
db.prepare(`INSERT INTO mock_hallmark_registry (stamp, purity_percentage, carat, logo, notes) VALUES (?,?,?,?,?)`).run(
  '22K916', '91.6%', 22, 'BIS Triangular Mark (Authentic)', 'Standard Indian hallmarked 22 carat gold format'
);
db.prepare(`INSERT INTO mock_huid_ledger (huid, jeweller_name, assaying_center, stamping_date, weight_grams, status) VALUES (?,?,?,?,?,?)`).run(
  'A1B2C3', 'Abha Jewels, Hyderabad', 'Hyd Hallmarking Lab', '2026-04-12', 14.5, 'VERIFIED'
);
db.prepare(`INSERT INTO gold_market_rates (rate_per_gram_inr, effective_date) VALUES (?,?)`).run(7000, '2026-09-20');

// Persona 6 — Lab Tech
db.prepare(`INSERT INTO lab_environmental_specs (is_number, clause_ref, ambient_temp_c, relative_humidity_pct, notes) VALUES (?,?,?,?,?)`).run(
  'IS 1786:2008', 'Clause 8.2', '27°C ± 2°C', '65% ± 5%', 'Mechanical tensile testing room environmental bounds'
);
db.prepare(`INSERT INTO validation_logs (upload_id, row_number, field_name, value_recorded, threshold_min, is_number, error_message) VALUES (?,?,?,?,?,?,?)`).run(
  'BULK-UPLOAD-992', 14, 'yield_stress_mpa', '150 MPa', 500, 'IS 1786:2008 Grade Fe 500D',
  'Row 14 contains an invalid entry. The recorded yield stress value of 150 MPa falls below the lower boundary threshold required for IS 1786 Grade Fe 500D.'
);
const is2062Table = JSON.stringify([
  { grade: 'E250 A', yield_mpa: 250, tensile_mpa: 410, elongation_pct: 23 },
  { grade: 'E300 A', yield_mpa: 300, tensile_mpa: 440, elongation_pct: 22 },
  { grade: 'E350 A', yield_mpa: 350, tensile_mpa: 490, elongation_pct: 22 },
]);
db.prepare(`INSERT INTO engineering_tables (is_number, title, table_json) VALUES (?,?,?)`).run(
  'IS 2062:2011', 'Structural steel mechanical properties matrix', is2062Table
);

// Persona 7 — Academic
const insertSemester = db.prepare(`INSERT INTO semester_publications (is_number, title, amendment_no, summary, published_at) VALUES (?,?,?,?,?)`);
insertSemester.run('IS 16444:2015', 'Smart Meters', 'Amendment 2', 'Updated cybersecurity parameters for smart metering infrastructure.', '2026-08-01');
insertSemester.run('IS 1554 (Part 1):1988', 'PVC Insulated Cables', 'Structural revision', 'Structural thickness adjustments for low voltage PVC cables.', '2026-08-01');
db.prepare(`INSERT INTO formula_derivations (topic, formula, variables_json, example_calculation, source_clause) VALUES (?,?,?,?,?)`).run(
  'high_voltage_insulation',
  'V = 2E + 1000V',
  '{"E":"rated operational voltage (V)","V":"breakdown test voltage (V AC)"}',
  'For 230V appliance: 2(230) + 1000 = 1460V AC sustained for 60 seconds.',
  'IS 302-2-30 Annex — dielectric strength derivation'
);
const insertDiff = db.prepare(`INSERT INTO standard_revision_diffs (is_number, parameter_field, old_edition, new_edition, old_value, new_value, evolution_context) VALUES (?,?,?,?,?,?,?)`);
insertDiff.run('IS 4151', 'Drop Impact Speed', '1993 Edition', '2018 Modern Edition', '5.0 meters/second', '7.5 meters/second', 'Scaled up to reflect higher highway transit speeds.');
insertDiff.run('IS 4151', 'Peak Deceleration', '1993 Edition', '2018 Modern Edition', '400g maximum limit', '300g maximum limit', 'Lowered to significantly reduce head trauma risks.');
insertDiff.run('IS 4151', 'Test Headform', '1993 Edition', '2018 Modern Edition', 'Metal Alloy Only', 'Bio-fidelic Synthetic Composite', 'Updated to simulate human skull dynamics accurately.');

// Persona 8 — Enforcement
db.prepare(`INSERT INTO mock_customs_hs_mapping (hs_code, product_description, is_number, qco_mandatory, clearance_notes) VALUES (?,?,?,?,?)`).run(
  '8504.40.90', 'Static converters / power inverters', 'IS 13252 (Part 1):2010', 1,
  'PORT ENFORCEMENT MANDATE: HS Code 8504.40.90 maps to IS 13252 (Power Inverters). Mandatory QCO — do not clear cargo without active registration certificate.'
);

console.log('Database seeded successfully with probe-ready demo data.');

// Import BIS MITRA synthetic demo datasets from /data/
const { importDemoData } = await import('./import-demo-data.mjs');
importDemoData(db);

spawnSync('node', ['scripts/build-demo-golden.mjs'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

// Merge MITRA knowledge PDFs into BIS tables
const sync = spawnSync('node', ['scripts/sync-knowledge-into-clone.mjs'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});
if (sync.status !== 0) console.warn('Knowledge sync warning — manifest may be missing');

// Close explicitly — Node 24 + better-sqlite3 can assert on GC teardown otherwise
db.close();
process.exit(0);
