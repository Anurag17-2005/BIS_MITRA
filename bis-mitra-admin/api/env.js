/**
 * Load bis-mitra-admin/.env into process.env.
 * Does not override a non-empty variable already set in the environment.
 * Empty strings are treated as unset so a blank shell variable cannot hide the file.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ROOT = path.resolve(__dirname, '..');

let loaded = false;

export function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  let applied = 0;
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^\uFEFF/, '');
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const current = process.env[key];
    if (current !== undefined && String(current).trim() !== '') continue;
    process.env[key] = val;
    applied += 1;
  }
  return applied;
}

function bootstrapPortalEnvAliases() {
  const pick = (...keys) => {
    for (const key of keys) {
      const v = process.env[key];
      if (v != null && String(v).trim() !== '') return String(v).trim().replace(/\/$/, '');
    }
    return '';
  };
  if (!pick('BIS_URL')) {
    const bis = pick('URL_BIS', 'BIS_WEB', 'BIS_WEB_URL', 'VITE_BIS_URL');
    if (bis) process.env.BIS_URL = bis;
  }
  if (!pick('MANAK_URL')) {
    const manak = pick('URL_MANAK', 'MANAK_WEB_URL', 'MANAK_APPLICATIONS_URL', 'VITE_MANAK_URL');
    if (manak) process.env.MANAK_URL = manak;
  }
  if (!pick('STANDARDS_URL')) {
    const standards = pick('URL_STANDARDS', 'STANDARDS_WEB', 'VITE_STANDARDS_URL');
    if (standards) process.env.STANDARDS_URL = standards;
  }
}

/** Idempotent. Safe to call from server startup and from the LLM module. */
export function ensureEnvLoaded() {
  if (loaded) return;
  loaded = true;
  loadEnvFile(path.join(ADMIN_ROOT, '.env'));
  loadEnvFile(path.join(__dirname, '.env'));
  bootstrapPortalEnvAliases();
}

/**
 * Presence check only. Never include the key value.
 */
export function groqKeyStatus() {
  ensureEnvLoaded();
  const key = String(process.env.GROQ_API_KEY || '').trim();
  return {
    present: key.length > 0,
    length: key.length,
    looksLikeGroq: key.startsWith('gsk_'),
    modelEnv: process.env.GROQ_MODEL || null,
    providerEnv: process.env.LLM_PROVIDER || null,
  };
}
