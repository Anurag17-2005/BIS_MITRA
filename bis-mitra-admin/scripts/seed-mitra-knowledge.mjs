import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C2_CLUSTER_ID } from '../api/clusters.js';
import { getStore, saveStore, updateClusterFileCounts } from '../api/store.js';
import { stampCatalog } from '../api/provenance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ADMIN_ROOT, '..', 'bis-clone', 'data', 'knowledge');
const MANIFEST_PATH = path.join(KNOWLEDGE_ROOT, 'manifest.json');
const PDFS_ROOT = path.join(KNOWLEDGE_ROOT, 'pdfs');
const UPLOAD_ROOT = path.join(ADMIN_ROOT, 'data', 'uploads', C2_CLUSTER_ID);

const FOLDER_TO_SECTION = {
  process: 'process',
  schemes: 'schemes',
  hallmarking: 'hallmarking',
  consumer: 'consumer',
  labs: 'labs',
  'standards-meta': 'standards',
  manuals: 'manuals',
};

const MARKING_FEE_NAMES = new Set([
  'marking-fee-all-products-2026.pdf',
  'marking-fee-gazette-2025.pdf',
]);

function safeFileName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function detectType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'Image';
  return 'PDF';
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

function sectionForManifestEntry(entry) {
  const folder = entry.folder;
  if (folder === 'manual') return mapManualFile(entry.name);
  return FOLDER_TO_SECTION[folder] || 'manuals';
}

function copyFile(srcPath, section, safeName) {
  const destDir = path.join(UPLOAD_ROOT, section);
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, safeName);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[seed:c2] missing source: ${srcPath}`);
    return null;
  }
  fs.copyFileSync(srcPath, destPath);
  return path.join('uploads', C2_CLUSTER_ID, section, safeName).replace(/\\/g, '/');
}

function upsertWarehouseRow(store, { section, safeName, storagePath, type, title, knowledgeFolder, seedTimestamp, sourceUrl }) {
  const id = `w-default-${C2_CLUSTER_ID}-${section}-${safeName}`;
  const row = {
    id,
    clusterId: C2_CLUSTER_ID,
    domain: section,
    name: safeName,
    type,
    source: 'default',
    protected: true,
    storagePath,
    updatedAt: seedTimestamp,
    meta: {
      title: title || safeName,
      knowledgeFolder: knowledgeFolder || section,
      sourceUrl: sourceUrl || null,
    },
  };
  const fullPath = path.join(ADMIN_ROOT, 'data', storagePath);
  const buffer = fs.existsSync(fullPath) ? fs.readFileSync(fullPath) : null;
  stampCatalog(row, null, {
    buffer,
    canonical_url: sourceUrl || `seed://mitra-knowledge/${section}/${safeName}`,
    license_class: 'public',
    fetched_at: seedTimestamp,
    fetch_id: `seed-${C2_CLUSTER_ID}`,
  });

  store.warehouse = store.warehouse.filter(w => w.id !== id);
  store.warehouse.push(row);
  return row;
}

function resolveSourcePath(entryPath, fileName) {
  if (entryPath) {
    const fromManifest = path.join(ADMIN_ROOT, '..', 'bis-clone', entryPath.replace(/^data\/knowledge\//, 'data/knowledge/'));
    if (fs.existsSync(fromManifest)) return fromManifest;
    const alt = path.join(KNOWLEDGE_ROOT, entryPath.replace(/^data\/knowledge\//, ''));
    if (fs.existsSync(alt)) return alt;
  }
  return null;
}

function collectManifestFiles() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`manifest not found: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  return manifest.files || [];
}

function collectManualFiles(manifestNames) {
  const manualDir = path.join(PDFS_ROOT, 'manual');
  if (!fs.existsSync(manualDir)) return [];
  const seen = new Set(manifestNames);
  return fs.readdirSync(manualDir)
    .filter(f => !f.startsWith('.'))
    .filter(f => !seen.has(f))
    .map(name => ({
      folder: 'manual',
      name,
      path: path.join('data/knowledge/pdfs/manual', name),
    }));
}

/**
 * Copy knowledge pack into C2 uploads and upsert protected warehouse rows.
 * @param {object} store - admin store (mutated in place)
 * @param {{ persist?: boolean }} options
 */
export function seedMitraKnowledge(store, options = {}) {
  const seedTimestamp = new Date().toISOString();
  let copied = 0;

  const manifestFiles = collectManifestFiles();
  const manifestNames = new Set(manifestFiles.map(f => f.name));
  const manualExtras = collectManualFiles(manifestNames);
  const allFiles = [...manifestFiles, ...manualExtras];

  for (const entry of allFiles) {
    const section = sectionForManifestEntry(entry);
    const safeName = safeFileName(entry.name);
    const srcPath = resolveSourcePath(entry.path, entry.name)
      || path.join(PDFS_ROOT, entry.folder || 'manual', entry.name);

    const storagePath = copyFile(srcPath, section, safeName);
    if (!storagePath) continue;

    const type = detectType(safeName);
    upsertWarehouseRow(store, {
      section,
      safeName,
      storagePath,
      type,
      title: entry.title || entry.name,
      knowledgeFolder: entry.folder || 'manual',
      seedTimestamp,
      sourceUrl: entry.url || (entry.path ? `file://${entry.path}` : null),
    });
    copied += 1;

    if (entry.folder === 'schemes' && MARKING_FEE_NAMES.has(entry.name)) {
      const feesPath = copyFile(srcPath, 'fees', safeName);
      if (feesPath) {
        upsertWarehouseRow(store, {
          section: 'fees',
          safeName,
          storagePath: feesPath,
          type,
          title: entry.title || entry.name,
          knowledgeFolder: entry.folder,
          seedTimestamp,
        });
        copied += 1;
      }
    }
  }

  updateClusterFileCounts(store);
  if (options.persist !== false && !store.version) {
    /* CLI mode passes store from getStore */
  }
  return { copied, sections: [...new Set(allFiles.map(f => sectionForManifestEntry(f)))] };
}

function main() {
  const store = getStore();
  const before = store.warehouse.filter(w => w.clusterId === C2_CLUSTER_ID).length;
  const { copied } = seedMitraKnowledge(store, { persist: false });
  updateClusterFileCounts(store);
  saveStore(store);
  const after = store.warehouse.filter(w => w.clusterId === C2_CLUSTER_ID).length;
  console.log(`[seed:c2] warehouse rows for ${C2_CLUSTER_ID}: ${before} → ${after} (${copied} files processed)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
