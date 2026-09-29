import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.AGENT_SESSION_DB
  || path.join(__dirname, '..', '..', 'data', 'agent-session.db');

let db = null;

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS session_context (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      persona TEXT,
      context_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_turns_session ON conversation_turns(session_id, created_at);

    CREATE TABLE IF NOT EXISTS conversation_summaries (
      session_id TEXT PRIMARY KEY,
      summary TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_alerts (
      alert_id TEXT PRIMARY KEY,
      session_id TEXT,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      priority TEXT DEFAULT 'normal',
      related_record_id TEXT,
      related_service_id TEXT,
      related_workflow_id TEXT,
      source TEXT,
      evidence_json TEXT,
      status TEXT DEFAULT 'active',
      read_flag INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_session ON user_alerts(session_id, read_flag, created_at);

    CREATE TABLE IF NOT EXISTS record_snapshots (
      session_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (session_id, record_id)
    );

    CREATE TABLE IF NOT EXISTS application_owners (
      reference_id TEXT PRIMARY KEY,
      session_id TEXT,
      user_id TEXT,
      persona TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function getSessionDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

/** @param {string} [suffix] test isolation */
export function resetSessionDbForTests(suffix = '') {
  if (db) {
    db.close();
    db = null;
  }
  const testPath = suffix ? `${DB_PATH.replace(/\.db$/, '')}-${suffix}.db` : DB_PATH;
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
  process.env.AGENT_SESSION_DB = testPath;
  return getSessionDb();
}

export function closeSessionDb() {
  if (db) {
    db.close();
    db = null;
  }
}
