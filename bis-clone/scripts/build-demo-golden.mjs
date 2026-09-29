/**
 * LEGACY: bypasses Admin warehouse. Prefer Admin ingest plans (ingest_demo_*)
 * via bis-mitra-admin → warehouse → transform golden pipeline.
 * This script writes golden JSON directly from Clone SQLite.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLUSTER_ID = process.env.DEMO_CLUSTER_ID || 'demo-pipeline-2';
const DATA_ROOT = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(__dirname, '..', 'data', 'bis-clone.db');
const GOLDEN_DIR = path.join(__dirname, '..', '..', 'bis-mitra-admin', 'data', 'indexes', CLUSTER_ID, 'golden');
const KNOWLEDGE_DEMO = path.join(__dirname, '..', 'data', 'knowledge', 'pdfs', 'demo');
const FILES_DEMO = path.join(__dirname, '..', 'public', 'files', 'demo');
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'demo-ingestion-manifest.json');

const SECTION_TAGS = {
  standards: 'chunk:standards', schemes: 'chunk:schemes', labs: 'chunk:labs',
  hallmarking: 'chunk:hallmarking', consumer: 'chunk:consumer',
};

const PDF_CATALOG = {
  standards: 'standards_demo.pdf', qco: 'qco_demo.pdf', certification: 'certification_demo.pdf',
  laboratories: 'laboratories_demo.pdf', hallmarking: 'hallmarking_demo.pdf',
  consumer: 'consumer_complaints_demo.pdf', enforcement: 'enforcement_demo.pdf',
  surveillance: 'surveillance_demo.pdf',
};

function hashText(t) {
  return crypto.createHash('sha256').update(t || '').digest('hex');
}

function srcRef(domain, demoId) {
  return `BIS MITRA Demo → ${domain} → ${demoId}`;
}

function baseGolden({ warehouseItemId, section, title, text, isNumbers, demoId, sourceFile, sourceType, synonyms, related, regulatory }) {
  const ingestedAt = new Date().toISOString();
  return {
    id: `golden-${warehouseItemId}`,
    warehouseItemId,
    clusterId: CLUSTER_ID,
    section,
    sectionTag: SECTION_TAGS[section] || `chunk:${section}`,
    source: 'clone_demo_ingest',
    protected: false,
    title,
    text,
    isNumbers: isNumbers || [],
    contentHash: hashText(text),
    duplicateOf: null,
    language: 'en',
    layman_synonyms: synonyms || [],
    related_standards: related || [],
    testing_machinery: [],
    regulatory: regulatory || { legal_status: 'synthetic_demo' },
    catalog: {
      artifact_id: warehouseItemId,
      document_key: title,
      canonical_url: `demo://${sourceFile}#${demoId}`,
      demo_id: demoId,
      source_file: sourceFile,
      source_reference: srcRef(section, demoId),
      source_type: sourceType,
      ingested_at: ingestedAt,
      license_class: 'synthetic_demo',
    },
    provenance: {
      updatedAt: ingestedAt,
      fetchMethod: 'clone_db',
      processedAt: ingestedAt,
      demo_id: demoId,
      source_file: sourceFile,
      source_reference: srcRef(section, demoId),
      source_type: sourceType,
      ingested_at: ingestedAt,
      fingerprint: hashText(`${demoId}:${title}`),
      licenseClass: 'synthetic_demo',
    },
    quality: { status: 'ok', warnings: [] },
  };
}

function writeGolden(record) {
  const safe = String(record.warehouseItemId).replace(/[^a-zA-Z0-9._-]/g, '_');
  const fp = path.join(GOLDEN_DIR, `${safe}.json`);
  fs.writeFileSync(fp, JSON.stringify(record, null, 2));
  return fp;
}

function copyPdfs() {
  fs.mkdirSync(KNOWLEDGE_DEMO, { recursive: true });
  fs.mkdirSync(FILES_DEMO, { recursive: true });
  for (const name of Object.values(PDF_CATALOG)) {
    const src = path.join(DATA_ROOT, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(KNOWLEDGE_DEMO, name));
      fs.copyFileSync(src, path.join(FILES_DEMO, name));
    }
  }
}

function loadStandardsJson() {
  const p = path.join(DATA_ROOT, 'standards_demo.json');
  if (!fs.existsSync(p)) return {};
  const { records } = JSON.parse(fs.readFileSync(p, 'utf8'));
  const map = {};
  for (const r of records) map[r.demo_id] = r;
  return map;
}

function buildFromDb(db) {
  const stdJson = loadStandardsJson();
  const records = [];
  const ingestedAt = new Date().toISOString();

  // Standards
  for (const s of db.prepare("SELECT * FROM standards WHERE demo_id IS NOT NULL").all()) {
    const rich = stdJson[s.demo_id] || {};
    const lines = [
      `# ${s.is_number}`,
      `## ${s.title}`,
      `**Status:** ${s.status} | **Sector:** ${s.department}`,
      `**Mandatory/Voluntary:** ${s.mandatory_voluntary}`,
    ];
    if (s.certification_applicability) lines.push(`**Certification:** ${s.certification_applicability}`);
    if (s.qco_reference) lines.push(`**QCO Reference:** ${s.qco_reference}`);
    if (s.amendment_status) lines.push(`**Amendment:** ${s.amendment_status}`);
    if (s.superseded_by_is) lines.push(`**Superseded By:** ${s.superseded_by_is}`);
    lines.push('', '## Scope', s.description || rich.scope || '');
    if (rich.key_requirements?.length) {
      lines.push('', '## Key Requirements');
      rich.key_requirements.forEach(k => lines.push(`- ${k}`));
    }
    if (rich.testing_requirements?.length) {
      lines.push('', '## Testing Requirements');
      rich.testing_requirements.forEach(t => lines.push(`- ${t}`));
    }
    const wid = `demo-${s.demo_id}`;
    records.push(writeGolden(baseGolden({
      warehouseItemId: wid, section: 'standards', title: `${s.is_number} — ${s.title}`,
      text: lines.join('\n'), isNumbers: [s.is_number], demoId: s.demo_id,
      sourceFile: PDF_CATALOG.standards, sourceType: 'sqlite+json',
      synonyms: rich.synonyms || [], related: rich.related_standards || [],
      regulatory: { legal_status: 'synthetic_demo', scheme_type: s.mandatory_voluntary },
    })));
  }

  // QCO
  for (const q of db.prepare('SELECT * FROM qco_orders WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# ${q.gazette_ref}`, `## ${q.product}`, `**IS Number:** ${q.is_number}`,
      `**Ministry:** ${q.ministry}`, `**Effective:** ${q.effective_date}`,
      `**Scheme:** ${q.scheme}`, `**Sector:** ${q.sector}`,
      '', q.legal_statute || '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${q.demo_id}`, section: 'schemes',
      title: `${q.gazette_ref} — ${q.product}`, text, isNumbers: q.is_number ? [q.is_number] : [],
      demoId: q.demo_id, sourceFile: PDF_CATALOG.qco, sourceType: 'sqlite',
      regulatory: { legal_status: 'synthetic_demo', enforcement: { enforcement_status: 'MANDATORY', effective_date: q.effective_date } },
    })));
  }

  // Certification / CML
  for (const c of db.prepare('SELECT * FROM mock_licensed_manufacturers WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# Licence ${c.licence_number}`, `## ${c.company_name}`,
      `**CML:** ${c.cml_number} | **Status:** ${c.status}`,
      `**IS Number:** ${c.is_number}`, `**Product:** ${c.product}`,
      `**Valid Until:** ${c.valid_until}`, `**Factory:** ${c.factory}`,
      '', c.risk_assessment || '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${c.demo_id}`, section: 'schemes',
      title: `CML ${c.cml_number} — ${c.company_name}`, text,
      isNumbers: c.is_number ? [c.is_number] : [], demoId: c.demo_id,
      sourceFile: PDF_CATALOG.certification, sourceType: 'sqlite',
    })));
  }

  // Labs
  for (const l of db.prepare('SELECT * FROM labs WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# ${l.name}`, `**Lab Code:** ${l.lab_code}`, `**Location:** ${l.city}, ${l.state}`,
      `**Scope:** ${l.scope}`, `**Capability:** ${l.capability || ''}`,
      `**NABL:** ${l.nabl_status}`, `**Queue:** ${l.queue_time_weeks} weeks`,
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${l.demo_id}`, section: 'labs', title: l.name, text,
      demoId: l.demo_id, sourceFile: PDF_CATALOG.laboratories, sourceType: 'sqlite',
    })));
  }

  // Hallmarking HUID
  for (const h of db.prepare('SELECT * FROM mock_huid_ledger WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# HUID ${h.huid}`, `**Jeweller:** ${h.jeweller_name}`,
      `**Assaying Centre:** ${h.assaying_center}`, `**Stamped:** ${h.stamping_date}`,
      `**Weight:** ${h.weight_grams}g | **Status:** ${h.status}`,
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${h.demo_id}`, section: 'hallmarking',
      title: `HUID ${h.huid}`, text, demoId: h.demo_id,
      sourceFile: PDF_CATALOG.hallmarking, sourceType: 'sqlite',
    })));
  }

  // Consumer complaints
  for (const g of db.prepare('SELECT * FROM mock_grievances WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# Complaint ${g.ticket_id}`, `**Merchant:** ${g.merchant_name}`,
      `**Product:** ${g.product_name || g.product_category}`, `**IS:** ${g.is_number || 'N/A'}`,
      `**Status:** ${g.status}`, '', g.complaint_details || '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${g.demo_id}`, section: 'consumer',
      title: `Complaint ${g.ticket_id}`, text,
      isNumbers: g.is_number ? [g.is_number] : [], demoId: g.demo_id,
      sourceFile: PDF_CATALOG.consumer, sourceType: 'sqlite',
    })));
  }

  // Enforcement
  for (const e of db.prepare('SELECT * FROM enforcement_cases').all()) {
    const text = [
      `# Case ${e.case_id}`, `**Type:** ${e.inspection_type}`, `**Date:** ${e.inspection_date}`,
      `**Manufacturer:** ${e.manufacturer}`, `**Product:** ${e.product}`,
      `**IS:** ${e.is_number} | **Licence:** ${e.licence_number}`,
      `**Severity:** ${e.severity}`, `**Status:** ${e.case_status}`,
      '', '## Finding', e.finding || '', '', '## Action', e.action_taken || '',
      e.surveillance_reference ? `\n**Surveillance Ref:** ${e.surveillance_reference}` : '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${e.demo_id}`, section: 'schemes',
      title: `Enforcement ${e.case_id}`, text,
      isNumbers: e.is_number ? [e.is_number] : [], demoId: e.demo_id,
      sourceFile: PDF_CATALOG.enforcement, sourceType: 'sqlite',
    })));
  }

  // Surveillance
  for (const s of db.prepare('SELECT * FROM surveillance_cases').all()) {
    const text = [
      `# Surveillance ${s.surveillance_id}`, `**Type:** ${s.surveillance_type}`,
      `**Product:** ${s.product}`, `**Manufacturer:** ${s.manufacturer}`,
      `**Sample:** ${s.sample_id} | **Lab:** ${s.laboratory}`,
      `**Test Result:** ${s.test_result}`, `**Compliance:** ${s.compliance_status}`,
      `**Risk:** ${s.risk_level}`, s.finding ? `\n## Finding\n${s.finding}` : '',
      s.enforcement_case_reference ? `\n**Enforcement Ref:** ${s.enforcement_case_reference}` : '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-${s.demo_id}`, section: 'schemes',
      title: `Surveillance ${s.surveillance_id}`, text,
      isNumbers: s.is_number ? [s.is_number] : [], demoId: s.demo_id,
      sourceFile: PDF_CATALOG.surveillance, sourceType: 'sqlite',
    })));
  }

  // Amendments
  for (const a of db.prepare('SELECT * FROM standard_amendments WHERE demo_id IS NOT NULL').all()) {
    const text = [
      `# Amendment ${a.amendment_no}`, `**IS:** ${a.is_number}`, `**Clause:** ${a.clause_ref}`,
      '## Previous', a.old_value || '', '## Revised', a.new_value || '',
      a.summary ? `\n**Reason:** ${a.summary}` : '',
    ].join('\n');
    records.push(writeGolden(baseGolden({
      warehouseItemId: `demo-amend-${a.id}`, section: 'standards',
      title: `${a.is_number} ${a.amendment_no}`, text,
      isNumbers: [a.is_number], demoId: a.demo_id, sourceFile: PDF_CATALOG.standards, sourceType: 'sqlite',
    })));
  }

  const manifest = {
    clusterId: CLUSTER_ID,
    ingestedAt,
    fingerprint: hashText(records.sort().join('|')),
    source: 'bis-clone SQLite + /data demo files',
    recordCount: records.length,
    domains: Object.keys(PDF_CATALOG),
    files: records.map(r => path.basename(r)),
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(GOLDEN_DIR, '_manifest.json'), JSON.stringify({
    clusterId: CLUSTER_ID,
    generatedAt: ingestedAt,
    pipeline: 'demo-golden-v2',
    recordCount: records.length,
    fingerprint: manifest.fingerprint,
  }, null, 2));

  return { recordCount: records.length, manifest };
}

export function buildDemoGolden() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('[build-demo-golden] DB not found — run seed first');
    return null;
  }
  copyPdfs();
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  // Remove legacy stub golden files
  for (const f of fs.readdirSync(GOLDEN_DIR)) {
    if (f.startsWith('w-demo-mitra_')) fs.unlinkSync(path.join(GOLDEN_DIR, f));
  }
  const db = new Database(DB_PATH, { readonly: true });
  const out = buildFromDb(db);
  db.close();
  console.log(`[build-demo-golden] wrote ${out.recordCount} golden records → ${GOLDEN_DIR}`);
  return out;
}

if (process.argv[1]?.endsWith('build-demo-golden.mjs')) {
  buildDemoGolden();
}
