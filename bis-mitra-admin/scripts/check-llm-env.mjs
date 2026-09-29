/**
 * Report whether LLM keys in .env are parseable — never prints secret values.
 * Usage: node scripts/check-llm-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [path.join(ROOT, '.env'), path.join(ROOT, 'api', '.env')];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ file: path.relative(ROOT, file), exists: false }));
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\uFEFF/, '').trim())
    .filter((l) => l && !l.startsWith('#'));
  const groq = lines.find((l) => /GROQ_API_KEY/.test(l)) || '';
  const value = groq.includes('=') ? groq.slice(groq.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
  console.log(JSON.stringify({
    file: path.relative(ROOT, file),
    exists: true,
    bom: text.charCodeAt(0) === 0xfeff,
    keyNames: lines.map((l) => l.split('=')[0].trim()),
    groqLinePresent: Boolean(groq),
    groqExportPrefix: /^export\s/i.test(groq),
    groqValueLength: value.length,
    groqValueLooksValid: /^gsk_[A-Za-z0-9]{20,}$/.test(value),
    groqModelSet: lines.some((l) => /^GROQ_MODEL=/.test(l)),
    llmProviderSet: lines.some((l) => /^LLM_PROVIDER=/.test(l)),
  }));
}
