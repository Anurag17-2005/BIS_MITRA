import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_PATTERNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'n'];
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'patterns-config.json'), 'utf8'));

function parseArgs(argv) {
  const opts = { patterns: ALL_PATTERNS, queries: {} };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all' || (arg === '--pattern' && argv[i + 1] === 'all')) {
      opts.patterns = ALL_PATTERNS;
      if (argv[i + 1] === 'all') i++;
    } else if (arg === '--patterns' || arg === '-p') {
      opts.patterns = argv[++i].split(',').map(p => p.trim().toLowerCase());
    } else if (arg.startsWith('--query-')) {
      const letter = arg.replace('--query-', '').toUpperCase();
      opts.queries[letter] = argv[++i];
    } else if (arg === '--queries') {
      Object.assign(opts.queries, JSON.parse(argv[++i]));
    } else if (arg.startsWith('pattern-')) {
      opts.patterns = [arg.replace('pattern-', '')];
    } else if (/^[a-gn]$/i.test(arg)) {
      opts.patterns = [arg.toLowerCase()];
    }
  }
  return opts;
}

function getQueryForPattern(letter, queries) {
  if (queries[letter]) return queries[letter];
  const cfg = config[letter];
  return cfg?.defaultQuery || '';
}

async function runScript(p, query) {
  const letter = p.toUpperCase();
  const env = {
    ...process.env,
    FETCH_QUERY: query,
    FETCH_IS_NUMBER: letter === 'F' ? query : (process.env.FETCH_IS_NUMBER || 'IS 623:2025'),
  };
  return new Promise((resolve, reject) => {
    const child = spawn('node', [`fetch-pattern-${p}.js`], {
      cwd: __dirname,
      stdio: 'inherit',
      env,
    });
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`Pattern ${letter} failed`))));
  });
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log('Patterns to run:', opts.patterns.map(p => p.toUpperCase()).join(', '));
  for (const p of opts.patterns) {
    const letter = p.toUpperCase();
    const query = getQueryForPattern(letter, opts.queries);
    console.log(`\n=== Pattern ${letter}${query ? ` (query: "${query}")` : ''} ===`);
    console.log(`Purpose: ${config[letter]?.description || ''}`);
    await runScript(p, query);
  }
  console.log('\nFetch complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
