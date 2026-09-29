import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_DIR = path.join(__dirname, '..', '..', 'bis-clone', 'playwright');
export const FETCH_ROOT = path.join(__dirname, '..', '..', 'bis-clone', 'data', 'fetched');

function latestRunDir(pattern) {
  const letter = String(pattern).toUpperCase();
  const root = path.join(FETCH_ROOT, letter);
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root)
    .map(name => ({ name, full: path.join(root, name) }))
    .filter(d => fs.statSync(d.full).isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));
  return dirs[0]?.full || null;
}

export function readLatestManifest(pattern) {
  const dir = latestRunDir(pattern);
  if (!dir) throw new Error(`No Playwright output for pattern ${pattern} under ${FETCH_ROOT}`);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { dir, manifest, pattern: String(pattern).toUpperCase() };
}

/** Absolute fetched path → relative path under data/fetched (for /api/files). */
export function toFetchedRel(filePath) {
  if (!filePath) return null;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(FETCH_ROOT, filePath);
  const rel = path.relative(FETCH_ROOT, abs).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null;
  return rel;
}

/**
 * Run one Playwright pattern script and return manifest + normalized files.
 */
export function runPlaywrightPattern(pattern, query = '') {
  const letter = String(pattern).toLowerCase();
  const script = path.join(PLAYWRIGHT_DIR, `fetch-pattern-${letter}.js`);
  if (!fs.existsSync(script)) {
    return Promise.reject(new Error(`Playwright script missing: fetch-pattern-${letter}.js`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], {
      cwd: PLAYWRIGHT_DIR,
      env: {
        ...process.env,
        FETCH_QUERY: query || '',
        FETCH_IS_NUMBER: query || process.env.FETCH_IS_NUMBER || 'IS 623:2025',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(
          `Playwright pattern ${String(pattern).toUpperCase()} exited ${code}. `
          + `Are Clone portals running (3001–3003)? ${stderr.slice(-400) || stdout.slice(-400)}`
        ));
        return;
      }
      try {
        const { dir, manifest } = readLatestManifest(pattern);
        const files = (manifest.files || []).map(f => {
          const rel = toFetchedRel(f);
          return {
            name: path.basename(f),
            path: rel,
            absPath: f,
            origin: 'playwright',
          };
        }).filter(f => f.path);
        resolve({
          pattern: String(pattern).toUpperCase(),
          dir,
          manifest,
          files,
          payload: {
            via: 'playwright',
            pattern: String(pattern).toUpperCase(),
            source_url: manifest.source_url,
            description: manifest.description,
            scraped: manifest.scraped_text || {},
            fetched_at: manifest.fetched_at,
            fileCount: files.length,
          },
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
