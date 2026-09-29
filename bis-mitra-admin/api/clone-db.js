import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLONE_DB_PATH = process.env.CLONE_DB_PATH
  || path.join(__dirname, '..', '..', 'bis-clone', 'data', 'bis-clone.db');

export function openCloneDb() {
  if (!fs.existsSync(CLONE_DB_PATH)) {
    throw new Error(`Clone SQLite not found at ${CLONE_DB_PATH}. Run bis-clone seed and start Clone B.`);
  }
  return new Database(CLONE_DB_PATH, { readonly: true, fileMustExist: true });
}

export function fingerprint(rows, keys) {
  const list = Array.isArray(rows) ? rows : [];
  return `${list.length}:${list.map(r => keys.map(k => r?.[k] ?? '').join('|')).join(';')}`;
}

export function cloneSyncMeta() {
  const db = openCloneDb();
  try {
    const news = db.prepare('SELECT id, title, published_at FROM news ORDER BY id').all();
    const standards = db.prepare('SELECT is_number, title, status FROM standards ORDER BY is_number').all();
    const manuals = db.prepare('SELECT is_number, title, pdf_path FROM product_manuals ORDER BY sr_no').all();
    const fees = db.prepare('SELECT is_number, title, fee_amount FROM marking_fees ORDER BY is_number').all();
    const applications = db.prepare('SELECT reference_id, company_name, is_number FROM applications ORDER BY id').all();
    const portalRows = (domain) => {
      try {
        return db.prepare(
          'SELECT title, pdf_path FROM portal_documents WHERE domain = ? ORDER BY id'
        ).all(domain);
      } catch {
        return [];
      }
    };
    const process = portalRows('process');
    const schemes = portalRows('schemes');
    const labsDocs = portalRows('labs');
    const hmDocs = portalRows('hallmarking');
    const consumerDocs = portalRows('consumer');
    const stdDocs = portalRows('standards');
    const feeDocs = portalRows('fees');
    return {
      dbPath: CLONE_DB_PATH,
      news: { count: news.length, fingerprint: fingerprint(news, ['title', 'published_at']) },
      standards: { count: standards.length + stdDocs.length, fingerprint: fingerprint(standards, ['is_number', 'title']) + '|' + fingerprint(stdDocs, ['title', 'pdf_path']) },
      manuals: { count: manuals.length, fingerprint: fingerprint(manuals, ['is_number', 'pdf_path']) },
      fees: { count: fees.length + feeDocs.length, fingerprint: fingerprint(fees, ['is_number', 'fee_amount']) + '|' + fingerprint(feeDocs, ['title', 'pdf_path']) },
      process: { count: process.length, fingerprint: fingerprint(process, ['title', 'pdf_path']) },
      schemes: { count: schemes.length, fingerprint: fingerprint(schemes, ['title', 'pdf_path']) },
      labs: { count: labsDocs.length, fingerprint: fingerprint(labsDocs, ['title', 'pdf_path']) },
      hallmarking: { count: hmDocs.length, fingerprint: fingerprint(hmDocs, ['title', 'pdf_path']) },
      consumer: { count: consumerDocs.length, fingerprint: fingerprint(consumerDocs, ['title', 'pdf_path']) },
      applications: { count: applications.length, fingerprint: fingerprint(applications, ['reference_id']) },
    };
  } finally {
    db.close();
  }
}
