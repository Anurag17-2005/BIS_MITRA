/**
 * Lightweight DB bootstrap for cloud deploy (Render free tier).
 * Full demo: run `node scripts/seed.js` locally and upload DB, or run full seed on a larger instance.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'bis-clone.db');

console.log('[seed-minimal] opening', dbPath);
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
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT,
    company_name TEXT,
    is_number TEXT,
    status TEXT
  );
`);

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (email, password, name) VALUES (?,?,?)').run(
    'demo@bis-mitra.in',
    'Demo@123',
    'Demo User',
  );
}

const stdCount = db.prepare('SELECT COUNT(*) AS c FROM standards').get().c;
if (stdCount === 0) {
  db.prepare(
    'INSERT INTO standards (is_number, title, year, status, description) VALUES (?,?,?,?,?)',
  ).run('IS 4151:2015', 'Helmet for cyclists', 2015, 'Active', 'Demo standard for cloud deploy.');
}

db.close();
console.log('[seed-minimal] done');
