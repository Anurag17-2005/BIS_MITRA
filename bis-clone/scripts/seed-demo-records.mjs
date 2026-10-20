#!/usr/bin/env node
/**
 * Upsert BIS MITRA demo standards (STD-DEMO-*) into bis-clone.db for agent probes.
 * Run after copying bis-clone.seed.db (Railway build or local).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLONE_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.CLONE_DB_PATH || path.join(CLONE_ROOT, 'data', 'bis-clone.db');
const STANDARDS_JSON = path.join(CLONE_ROOT, '..', 'data', 'standards.json');

function ensureColumn(db, table, column, typeSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  }
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('[seed-demo-records] DB missing — skip', DB_PATH);
    process.exit(0);
  }
  if (!fs.existsSync(STANDARDS_JSON)) {
    console.warn('[seed-demo-records] standards.json missing — skip');
    process.exit(0);
  }

  const { records = [] } = JSON.parse(fs.readFileSync(STANDARDS_JSON, 'utf8'));
  const db = new Database(DB_PATH);
  for (const col of ['demo_id', 'source_reference', 'source_file', 'certification_applicability', 'amendment_status', 'qco_reference', 'superseded_by_is']) {
    ensureColumn(db, 'standards', col, 'TEXT');
  }

  const upsert = db.prepare(`
    INSERT INTO standards (
      is_number, title, year, status, department, committee, mandatory_voluntary,
      reviewed_year, pdf_path, description, demo_id, source_reference, source_file,
      certification_applicability, amendment_status, qco_reference
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(is_number) DO UPDATE SET
      title=excluded.title,
      year=excluded.year,
      status=excluded.status,
      description=excluded.description,
      demo_id=excluded.demo_id,
      source_reference=excluded.source_reference,
      source_file=excluded.source_file,
      certification_applicability=excluded.certification_applicability,
      amendment_status=excluded.amendment_status,
      qco_reference=excluded.qco_reference
  `);

  let n = 0;
  for (const r of records) {
    const isNumber = r.standard_number || r.is_number;
    if (!isNumber || !r.demo_id) continue;
    const desc = [r.scope, ...(r.key_requirements || [])].filter(Boolean).join(' ').slice(0, 4000);
    upsert.run(
      isNumber,
      r.title || isNumber,
      parseInt(String(r.edition_year || '2026'), 10) || 2026,
      r.status || 'Active',
      r.sector || 'Demo',
      r.sub_sector || '',
      /mandatory/i.test(String(r.certification_applicability || '')) ? 'Mandatory' : 'Voluntary',
      parseInt(String(r.edition_year || '2026'), 10) || 2026,
      r.source_file ? `knowledge/pdfs/demo/${path.basename(String(r.source_file))}` : 'knowledge/pdfs/demo/standards.pdf',
      desc || r.scope || '',
      r.demo_id,
      r.source_reference || `BIS MITRA Demo → Standards → ${r.demo_id}`,
      r.source_file || 'standards.pdf',
      r.certification_applicability || '',
      r.amendment_status || '',
      r.qco_reference || '',
    );
    n += 1;
  }

  db.close();
  console.log(`[seed-demo-records] upserted ${n} demo standard(s) into ${DB_PATH}`);
}

main();
