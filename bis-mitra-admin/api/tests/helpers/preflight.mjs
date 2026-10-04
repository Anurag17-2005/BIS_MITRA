#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMIN, CLONE, fetchJson } from './http.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ROOT = path.join(__dirname, '..', '..', '..');
const SESSION_DB = path.join(ADMIN_ROOT, 'data', 'agent-session.db');
const CLONE_DB = path.join(ADMIN_ROOT, '..', 'bis-clone', 'data', 'bis-clone.db');

let failed = 0;

function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`OK  ${msg}`);
}

async function main() {
  const adminHealth = await fetchJson(`${ADMIN}/api/health`);
  if (adminHealth.ok) ok(`admin ${ADMIN}/api/health`);
  else fail(`admin health (${adminHealth.status})`);

  const cloneHealth = await fetchJson(`${CLONE}/api/health`);
  if (cloneHealth.ok) ok(`clone ${CLONE}/api/health`);
  else fail(`clone health (${cloneHealth.status}) — start bis-clone on :4000`);

  if (fs.existsSync(CLONE_DB)) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(CLONE_DB, { readonly: true, fileMustExist: true });
      db.prepare('SELECT 1').get();
      db.close();
      ok('bis-clone.db opens');
    } catch (e) {
      fail(`bis-clone.db: ${e.message} — copy bis-clone.seed.db`);
    }
  } else {
    console.warn('WARN bis-clone.db missing (optional if CLONE_API is remote)');
  }

  if (fs.existsSync(SESSION_DB)) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(SESSION_DB);
      db.prepare('SELECT 1').get();
      db.close();
      ok('agent-session.db opens');
    } catch (e) {
      fail(`agent-session.db corrupt: ${e.message} — delete data/agent-session.db*`);
    }
  } else {
    ok('agent-session.db (will be created on first chat)');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
