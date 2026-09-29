import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_RULES, RULES_SEED_VERSION } from './rules-defaults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', 'data', 'rules', 'rules-store.json');

function loadFile() {
  if (!fs.existsSync(RULES_PATH)) {
    const initial = {
      version: 1,
      seedVersion: RULES_SEED_VERSION,
      rules: DEFAULT_RULES,
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
    fs.writeFileSync(RULES_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const data = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  if (!data.rules?.length || (data.seedVersion || 0) < RULES_SEED_VERSION) {
    data.rules = DEFAULT_RULES;
    data.seedVersion = RULES_SEED_VERSION;
    saveFile(data);
  }
  return data;
}

function saveFile(data) {
  data.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
  fs.writeFileSync(RULES_PATH, JSON.stringify(data, null, 2));
  return data;
}

export function listRules({ type, search } = {}) {
  const { rules } = loadFile();
  let out = [...rules];
  if (type && type !== 'all') {
    out = out.filter(r => r.type === type);
  }
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    out = out.filter(r =>
      r.name.toLowerCase().includes(q)
      || r.id.toLowerCase().includes(q)
      || r.description?.toLowerCase().includes(q)
      || r.category?.toLowerCase().includes(q)
    );
  }
  return out;
}

export function getRule(id) {
  const { rules } = loadFile();
  return rules.find(r => r.id === id) || null;
}

export function createRule(rule) {
  const data = loadFile();
  if (data.rules.some(r => r.id === rule.id)) {
    throw new Error(`Rule ${rule.id} already exists`);
  }
  data.rules.push(rule);
  saveFile(data);
  return rule;
}

export function updateRule(id, patch) {
  const data = loadFile();
  const idx = data.rules.findIndex(r => r.id === id);
  if (idx < 0) throw new Error(`Rule ${id} not found`);
  data.rules[idx] = { ...data.rules[idx], ...patch, id };
  saveFile(data);
  return data.rules[idx];
}

export function deleteRule(id) {
  const data = loadFile();
  const before = data.rules.length;
  data.rules = data.rules.filter(r => r.id !== id);
  if (data.rules.length === before) throw new Error(`Rule ${id} not found`);
  saveFile(data);
  return { ok: true };
}

export function resetRules() {
  const data = {
    version: 1,
    seedVersion: RULES_SEED_VERSION,
    rules: DEFAULT_RULES,
    updatedAt: new Date().toISOString(),
  };
  saveFile(data);
  return data.rules;
}
