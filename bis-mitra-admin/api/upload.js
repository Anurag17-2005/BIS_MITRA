import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SECTIONS } from './sections.js';
import { warehouseViewUrl } from './fileUrls.js';
import { recordFetch, stampCatalog } from './provenance.js';
import { stampRegulatoryOnItem } from './regulatory-stamp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '..', 'data', 'uploads');

const VALID_DOMAINS = new Set(SECTIONS.map(s => s.id));

function safeFileName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function detectType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'JSON';
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'Image';
  return 'PDF';
}

/**
 * Save uploaded file and upsert warehouse row (replace same name in section).
 */
export function saveUpload(store, clusterId, domain, fileName, buffer, note = '') {
  if (!VALID_DOMAINS.has(domain)) {
    throw new Error(`Invalid section: ${domain}`);
  }
  const name = safeFileName(fileName);
  if (!name) throw new Error('fileName required');

  const dir = path.join(UPLOAD_ROOT, clusterId, domain);
  fs.mkdirSync(dir, { recursive: true });
  const diskPath = path.join(dir, name);
  fs.writeFileSync(diskPath, buffer);

  const now = new Date().toISOString();
  const type = detectType(name);
  const relPath = path.join('uploads', clusterId, domain, name);

  let content = null;
  if (type === 'JSON') {
    try {
      content = JSON.parse(buffer.toString('utf8'));
    } catch {
      content = { raw: buffer.toString('utf8').slice(0, 5000) };
    }
  }

  const prev = store.warehouse.find(
    w => w.clusterId === clusterId && w.domain === domain && w.name === name && w.source === 'upload'
  );

  const item = {
    id: `w-upload-${clusterId}-${domain}-${name}`,
    sourceKey: 'upload',
    source: 'upload',
    name,
    domain,
    type,
    planId: null,
    clusterId,
    updatedAt: now,
    storagePath: relPath,
    note: note || '',
    ...(content ? { content } : { filePath: null }),
  };
  item.viewUrl = warehouseViewUrl(item);
  stampCatalog(item, null, {
    buffer,
    license_class: 'user_provided',
    canonical_url: `upload://${clusterId}/${domain}/${name}`,
    fetched_at: now,
    version: prev?.catalog?.version ? prev.catalog.version + 1 : 1,
    superseded_by: null,
  });

  const { fetchId } = recordFetch(store, {
    clusterId,
    planId: null,
    sourceId: 'manual_upload',
    startedAt: now,
    finishedAt: now,
    seedUrls: [item.catalog.canonical_url],
    artifacts: [{
      artifact_id: item.id,
      fileName: name,
      buffer,
      sha256: item.catalog.content_sha256,
      mime_type: item.catalog.mime_type,
      bytes: item.catalog.bytes,
      url: item.catalog.canonical_url,
    }],
    errors: [],
  });
  item.catalog.fetch_id = fetchId;
  stampRegulatoryOnItem(item, { section: domain });
  if (prev?.catalog?.content_sha256 && prev.catalog.content_sha256 !== item.catalog.content_sha256) {
    prev.catalog.superseded_by = item.id;
  }

  store.warehouse = store.warehouse.filter(
    w => !(w.clusterId === clusterId && w.domain === domain && w.name === name && w.source === 'upload')
  );
  store.warehouse.push(item);
  return item;
}
