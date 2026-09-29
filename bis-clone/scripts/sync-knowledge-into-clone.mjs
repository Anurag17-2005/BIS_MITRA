/**
 * Classify every knowledge pack file into portal_documents so BIS and cluster
 * ingest share one logical corpus (process / schemes / fees / manuals / etc.).
 * Served at: http://localhost:4000/files/knowledge/pdfs/{folder}/{file}
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const dbPath = path.join(ROOT, 'data', 'bis-clone.db');
const pdfsRoot = path.join(ROOT, 'data', 'knowledge', 'pdfs');

if (!fs.existsSync(dbPath)) {
  console.warn('[sync-knowledge] DB missing — run seed.js first');
  process.exit(0);
}
if (!fs.existsSync(pdfsRoot)) {
  console.warn('[sync-knowledge] knowledge/pdfs missing — skip');
  process.exit(0);
}

const db = new Database(dbPath);

const MARKING_FEE_NAMES = new Set([
  'marking-fee-all-products-2026.pdf',
  'marking-fee-gazette-2025.pdf',
]);

const FOLDER_DOMAIN = {
  process: 'process',
  schemes: 'schemes',
  hallmarking: 'hallmarking',
  consumer: 'consumer',
  labs: 'labs',
  'standards-meta': 'standards',
  manuals: 'manuals',
};

function titleFromFile(name) {
  return name
    .replace(/\.(pdf|png|jpe?g)$/i, '')
    .replace(/\(\d+\)\s*$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function walkFiles(dir, folder = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      out.push(...walkFiles(abs, folder ? `${folder}/${name}` : name));
      continue;
    }
    if (!/\.(pdf|png|jpe?g)$/i.test(name)) continue;
    const folderName = folder.split('/')[0] || 'manuals';
    out.push({
      folder: folderName,
      name,
      abs,
      bytes: st.size,
      rel: `knowledge/pdfs/${folder ? `${folder}/` : ''}${name}`.replace(/\\/g, '/'),
    });
  }
  return out;
}

function mapManualFile(fileName) {
  const base = path.basename(fileName);
  const lower = base.toLowerCase();
  if (/^complaint_/i.test(base) || base === 'Guidelines.pdf') return 'consumer';
  if (/qco/i.test(base) || /^so[\s-]?no/i.test(base) || /^gsr/i.test(base) || /gazette/i.test(lower)) {
    return 'schemes';
  }
  if (/^screenshot.*scheme/i.test(lower)) return 'schemes';
  if (/lab/i.test(lower) || /lims/i.test(lower)) return 'labs';
  if (/hallmark/i.test(lower) || /jewell/i.test(lower)) return 'hallmarking';
  if (/^bis_feb_mar/i.test(base)) return 'news';
  if (/^renewal/i.test(base) || /^form/i.test(base)) return 'process';
  if (/^screenshot/i.test(base)) {
    if (/hallmark|jewell/i.test(lower)) return 'hallmarking';
    if (/lab|lims/i.test(lower)) return 'labs';
    return 'schemes';
  }
  return 'manuals';
}

function classify(file) {
  if (file.folder === 'schemes' && MARKING_FEE_NAMES.has(file.name)) return 'fees';
  if (file.folder === 'manual') return mapManualFile(file.name);
  return FOLDER_DOMAIN[file.folder] || 'process';
}

function isFromManualName(name) {
  if (/3055/i.test(name)) return 'IS 3055 (Part 1):1994';
  if (/4151/i.test(name)) return 'IS 4151:2015';
  if (/623/i.test(name) && /frame|bicycle/i.test(name)) return 'IS 623:2025';
  if (/10613/i.test(name)) return 'IS 10613:2014';
  if (/269/i.test(name) && /cement/i.test(name)) return 'IS 269:2015';
  return null;
}

function ensureCol(table, column, sql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sql}`);
}

ensureCol('regulatory_guidance', 'pdf_path', 'TEXT');
ensureCol('consumer_topics', 'body', 'TEXT');
ensureCol('consumer_topics', 'pdf_path', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS portal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    size_kb INTEGER,
    pdf_path TEXT NOT NULL,
    mime TEXT
  );
`);
db.exec('DELETE FROM portal_documents');
db.exec('DELETE FROM process_documents');
db.exec(`DELETE FROM regulatory_guidance WHERE keywords LIKE '%knowledge%' OR pdf_path LIKE 'knowledge/%'`);

const insertPortal = db.prepare(
  `INSERT INTO portal_documents (domain, title, filename, size_kb, pdf_path, mime) VALUES (?,?,?,?,?,?)`
);
const insertProc = db.prepare(
  `INSERT INTO process_documents (title, scheme, size_kb, pdf_path) VALUES (?,?,?,?)`
);
const insertGuidance = db.prepare(
  `INSERT OR REPLACE INTO regulatory_guidance (slug, title, category, content, keywords, pdf_path) VALUES (?,?,?,?,?,?)`
);
const updateManual = db.prepare(
  `UPDATE product_manuals SET pdf_path = ?, size_mb = ?, title = ? WHERE is_number = ?`
);
const insertManual = db.prepare(
  `INSERT INTO product_manuals (sr_no, is_number, title, size_mb, pdf_path) VALUES (?,?,?,?,?)`
);
const updateConsumerPdf = db.prepare(
  `UPDATE consumer_topics SET pdf_path = COALESCE(pdf_path, ?), body = COALESCE(NULLIF(body,''), ?) WHERE slug = ?`
);
const insertConsumer = db.prepare(
  `INSERT OR IGNORE INTO consumer_topics (slug, title, category, summary, keywords, body, pdf_path)
   VALUES (?,?,?,?,?,?,?)`
);

const files = walkFiles(pdfsRoot);
const counts = {};
let proc = 0;
let manuals = 0;
let guide = 0;
let consumer = 0;
let sr = db.prepare('SELECT MAX(sr_no) as n FROM product_manuals').get()?.n || 0;

for (const file of files) {
  const domain = classify(file);
  counts[domain] = (counts[domain] || 0) + 1;
  const sizeKb = Math.round((file.bytes || 0) / 1024);
  const sizeMb = Math.round(((file.bytes || 0) / (1024 * 1024)) * 10) / 10;
  const title = titleFromFile(file.name);
  const slug = file.name.replace(/\.(pdf|png|jpe?g)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
  const mime = /\.pdf$/i.test(file.name)
    ? 'application/pdf'
    : /\.png$/i.test(file.name)
      ? 'image/png'
      : 'image/jpeg';

  insertPortal.run(domain, title, file.name, sizeKb, file.rel, mime);

  if (domain === 'process') {
    insertProc.run(title, 'Scheme-I (Conformity Assessment)', sizeKb, file.rel);
    proc++;
  }

  if (file.folder === 'manuals') {
    const isNum = isFromManualName(file.name);
    if (isNum) {
      const existing = db.prepare('SELECT id FROM product_manuals WHERE is_number = ?').get(isNum);
      if (existing) updateManual.run(file.rel, sizeMb, title, isNum);
      else insertManual.run(++sr, isNum, title, sizeMb, file.rel);
      manuals++;
    }
  }

  if (domain === 'consumer' && /\.pdf$/i.test(file.name)) {
    const mappedSlug = /complaint.*certified|complaint-guidelines/i.test(file.name)
      ? 'complaint-certified'
      : /ompc|handling/i.test(file.name)
        ? 'complaint-certified'
        : /guidelines\.pdf/i.test(file.name)
          ? 'verify-is-mark'
          : slug;
    const body = `Official BIS consumer document: ${title}. Download the PDF for the full procedure, forms, and timelines.`;
    const r = updateConsumerPdf.run(file.rel, body, mappedSlug);
    if (!r.changes) {
      insertConsumer.run(
        slug,
        title,
        'Complaints',
        body,
        `consumer,complaint,${file.name}`,
        body,
        file.rel,
      );
    }
    consumer++;
    insertGuidance.run(
      slug,
      title,
      'consumer',
      body,
      `consumer,bis,knowledge,${file.name}`,
      file.rel,
    );
    guide++;
  }

  if (['hallmarking', 'labs', 'schemes', 'standards', 'fees'].includes(domain) && /\.pdf$/i.test(file.name)) {
    insertGuidance.run(
      slug,
      title,
      domain,
      `Official BIS document from bis.gov.in: ${title}. Open the PDF for the complete text, tables, and annexes.`,
      `${domain},bis,knowledge,${file.name}`,
      file.rel,
    );
    guide++;
  }
}

db.prepare(
  `UPDATE product_manuals SET pdf_path = NULL WHERE pdf_path LIKE 'manuals/IS-%' AND pdf_path NOT LIKE 'knowledge/%'`
).run();

console.log(
  `[sync-knowledge] files=${files.length} portal=${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')} process_page=${proc} manuals=${manuals} guidance=${guide} consumer_pdfs=${consumer}`
);

db.close();
process.exit(0);
