import fs from 'fs';
import path from 'path';
import { PATHS } from '../core/config/paths.js';

let byName = null;

function walk(dir, rel, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const next = rel ? `${rel}/${name}` : name;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) walk(full, next, out);
    else if (name.toLowerCase().endsWith('.pdf')) out.set(name.toLowerCase(), `knowledge/pdfs/${next}`);
  }
}

function pdfIndex() {
  if (!byName) {
    byName = new Map();
    walk(PATHS.knowledgePdfs, '', byName);
  }
  return byName;
}

function asStorage(hint) {
  if (!hint) return null;
  const raw = String(hint).replace(/\\/g, '/').replace(/^\/+/, '');
  if (raw.startsWith('knowledge/pdfs/')) return raw;
  const base = raw.split('/').pop();
  if (!base || !base.toLowerCase().endsWith('.pdf')) return null;
  return pdfIndex().get(base.toLowerCase()) || null;
}

/** Map a retrieval hit to knowledge/pdfs/... when the chunk only stores a filename or plan URL. */
export function resolvePdfStorageFromHit(hit) {
  const meta = hit?.metadata || {};
  const direct = asStorage(meta.source_file || hit?.source_file || meta.storage_uri);
  if (direct) return direct;

  const blob = [
    hit?.chunkId,
    hit?.warehouseItemId,
    hit?.citation?.source_url,
    hit?.sourceUrl,
    meta.source_file,
    meta.source_reference,
  ].filter(Boolean).join(' ').toLowerCase();

  let best = null;
  for (const [name, storage] of pdfIndex()) {
    if (blob.includes(name) && (!best || name.length > best.name.length)) {
      best = { name, storage };
    }
  }
  return best?.storage || null;
}

export function passageLabel(text, index = 0) {
  let clean = String(text || '')
    .replace(/\[Context Hierarchy:[^\]]*\]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const start = clean.search(/(?:^|\s)(\d{1,2}(?:\.\d+)+|[A-Z][A-Za-z]{2,})/);
  if (start > 0 && start < 80) clean = clean.slice(start).trim();
  const clause = clean.match(/\b(\d{1,2}(?:\.\d+)+)\b/);
  if (clause) {
    const at = clean.indexOf(clause[1]);
    return clean.slice(at, at + 90).trim();
  }
  if (clean) return clean.slice(0, 90).trim();
  return null;
}
