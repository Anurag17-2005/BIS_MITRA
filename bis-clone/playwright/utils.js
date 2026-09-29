import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FETCH_ROOT = path.join(__dirname, '..', 'data', 'fetched');

export function saveManifest(pattern, data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(FETCH_ROOT, pattern, ts);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ pattern, fetched_at: new Date().toISOString(), ...data }, null, 2));
  console.log(`[Pattern ${pattern}] Saved manifest to ${manifestPath}`);
  return { dir, manifestPath };
}

export function saveFile(dir, filename, content) {
  const filePath = path.join(dir, filename);
  if (Buffer.isBuffer(content)) {
    fs.writeFileSync(filePath, content);
  } else {
    fs.writeFileSync(filePath, content);
  }
  return filePath;
}
