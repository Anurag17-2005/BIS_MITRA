import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONNECTOR_BY_BASE, sectionForPlan } from './sections.js';
import { buildPlansForCluster } from './plan-templates.js';
import { normalizeFetchMethod, PLAYWRIGHT_BY_BASE } from './methods.js';
import {
  C1_CLUSTER_ID,
  C2_CLUSTER_ID,
  planIdForCluster,
  stripClusterPrefix,
} from './clusters.js';
import { backfillWarehouseCatalog } from './provenance.js';
import { clearTransformData } from './transformation/service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '..', 'data', 'admin-store.json');
const UPLOADS_ROOT = path.join(__dirname, '..', 'data', 'uploads');
const STORE_VERSION = 15;

function loadDefault() {
  return {
    version: STORE_VERSION,
    clusters: [],
    plans: [],
    warehouse: [],
    history: [],
    snapshots: [],
    fetches: [],
    ingestionFailures: [],
    automation: {
      enabled: true,
      pollIntervalMs: 30000,
      lastCheckAt: null,
      lastRunAt: null,
      lastRunStatus: null,
      autoTransform: true,
      promoteOnPublished: true,
      targetClusterIds: [],
      autofetchClusterIds: [],
      cloneFingerprints: {},
      lastSyncedFingerprints: {},
    },
    automationEvents: [],
  };
}

export function normalizePlan(plan) {
  if (typeof plan.schedule === 'string') {
    const match = plan.schedule.match(/(\d{1,2}):(\d{2})/);
    plan.schedule = {
      enabled: false,
      frequency: 'daily',
      time: match ? `${match[1].padStart(2, '0')}:${match[2]}` : '02:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      lastFiredKey: null,
    };
  } else if (!plan.schedule || typeof plan.schedule !== 'object') {
    plan.schedule = {
      enabled: false,
      frequency: 'daily',
      time: '02:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      lastFiredKey: null,
    };
  } else {
    if (!plan.schedule.frequency) plan.schedule.frequency = 'daily';
    if (plan.schedule.dayOfWeek == null) plan.schedule.dayOfWeek = 1;
    if (plan.schedule.dayOfMonth == null) plan.schedule.dayOfMonth = 1;
  }
  const base = stripClusterPrefix(plan.id, plan.clusterId);
  if (!plan.connector) {
    plan.connector = CONNECTOR_BY_BASE[base] || plan.id;
  }
  if (plan.playwrightPattern === undefined) {
    plan.playwrightPattern = PLAYWRIGHT_BY_BASE[base] ?? null;
  }
  plan.method = normalizeFetchMethod(plan.method);
  plan.playwrightPattern = PLAYWRIGHT_BY_BASE[base] ?? plan.playwrightPattern ?? null;
  if (!plan.section && plan.kind === 'ingest') {
    plan.section = sectionForPlan(plan);
  }
  return plan;
}

function reIdClusterRefs(store, fromId, toId) {
  for (const w of store.warehouse || []) {
    if (w.clusterId === fromId) w.clusterId = toId;
  }
  for (const h of store.history || []) {
    if (h.clusterId === fromId) h.clusterId = toId;
  }
  for (const p of store.plans || []) {
    if (p.clusterId === fromId) p.clusterId = toId;
  }
}

function reIdPlanRefs(store, fromId, toId) {
  for (const h of store.history || []) {
    if (h.planId === fromId) h.planId = toId;
  }
  for (const s of store.snapshots || []) {
    if (s.planId === fromId) s.planId = toId;
  }
  for (const w of store.warehouse || []) {
    if (w.planId === fromId) w.planId = toId;
  }
}

function migrateToV7(store) {
  const c1 = store.clusters?.find(c => c.id === 'global-bis');
  if (c1) {
    c1.id = C1_CLUSTER_ID;
    c1.name = 'Demo Pipeline';
    c1.description = 'Thin clone-fetched demo data — mutable, for testing ingest';
    c1.published = false;
    c1.secured = false;
    c1.deletable = true;
    c1.renamable = true;
    reIdClusterRefs(store, 'global-bis', C1_CLUSTER_ID);
  } else if (!store.clusters?.find(c => c.id === C1_CLUSTER_ID)) {
    store.clusters = store.clusters || [];
    store.clusters.unshift({
      id: C1_CLUSTER_ID,
      name: 'Demo Pipeline',
      description: 'Thin clone-fetched demo data — mutable, for testing ingest',
      published: false,
      secured: false,
      deletable: true,
      renamable: true,
      fileCount: 0,
    });
  }

  reIdClusterRefs(store, 'sandbox', C1_CLUSTER_ID);

  const demoBaseIds = new Set(
    (store.plans || [])
      .filter(p => p.clusterId === C1_CLUSTER_ID)
      .map(p => stripClusterPrefix(p.id, C1_CLUSTER_ID))
  );
  store.plans = (store.plans || []).filter(p => {
    if (p.clusterId !== 'sandbox') return true;
    const base = stripClusterPrefix(p.id, 'sandbox');
    return !demoBaseIds.has(base);
  });
  for (const p of store.plans) {
    if (p.clusterId === 'sandbox') p.clusterId = C1_CLUSTER_ID;
  }

  store.clusters = (store.clusters || []).filter(c => c.id !== 'sandbox');

  if (!store.clusters.find(c => c.id === C2_CLUSTER_ID)) {
    store.clusters.push({
      id: C2_CLUSTER_ID,
      name: 'MITRA Knowledge',
      description: 'Full BIS knowledge pack corpus — secured seed files',
      published: true,
      secured: true,
      deletable: false,
      renamable: false,
      fileCount: 0,
    });
  } else {
    const c2 = store.clusters.find(c => c.id === C2_CLUSTER_ID);
    c2.secured = true;
    c2.deletable = false;
    c2.renamable = false;
    c2.published = true;
  }

  for (const c of store.clusters) {
    if (c.id === C1_CLUSTER_ID) {
      c.secured = false;
      c.deletable = c.deletable !== false;
      c.renamable = c.renamable !== false;
    }
    if (c.id !== C2_CLUSTER_ID && c.id !== C1_CLUSTER_ID) {
      c.secured = c.secured ?? false;
      c.deletable = c.deletable !== false;
      c.renamable = c.renamable !== false;
    }
  }

  if (store.clusters.find(c => c.id === C2_CLUSTER_ID)?.published) {
    for (const c of store.clusters) {
      if (c.id !== C2_CLUSTER_ID) c.published = false;
    }
  }

  const planIdMap = new Map();
  for (const p of store.plans || []) {
    if (p.clusterId === C1_CLUSTER_ID) continue;
    const base = stripClusterPrefix(p.id, p.clusterId);
    const newId = planIdForCluster(p.clusterId, base);
    if (p.id !== newId) {
      planIdMap.set(p.id, newId);
      p.id = newId;
    }
  }
  for (const [fromId, toId] of planIdMap) {
    reIdPlanRefs(store, fromId, toId);
  }

  for (const sp of buildPlansForCluster(C1_CLUSTER_ID)) {
    if (!store.plans.find(p => p.id === sp.id)) store.plans.push(sp);
  }
  for (const w of store.warehouse || []) {
    if (!w.source) w.source = w.planId ? 'fetch' : 'upload';
  }
  if (!store.snapshots) store.snapshots = [];
}

function migrateStore(store) {
  const fromVersion = store.version || 0;

  if (fromVersion < 6) {
    store.plans = (store.plans || []).map(normalizePlan);
    if (!store.snapshots) store.snapshots = [];
    for (const w of store.warehouse || []) {
      if (!w.source) w.source = w.planId ? 'fetch' : 'upload';
    }
  }

  if (fromVersion < 7) {
    migrateToV7(store);
  }

  if (fromVersion < 8) {
    migrateToV8(store);
  }

  if (fromVersion < 9) {
    migrateToV9(store);
  }

  if (fromVersion < 10) {
    if (!store.fetches) store.fetches = [];
    if (!store.ingestionFailures) store.ingestionFailures = [];
    backfillWarehouseCatalog(store);
  }

  if (fromVersion < 11) {
    if (!store.automation) {
      store.automation = {
        enabled: true,
        pollIntervalMs: 30000,
        lastCheckAt: null,
        lastRunAt: null,
        lastRunStatus: null,
        autoTransform: true,
        promoteOnPublished: true,
        targetClusterIds: [],
        cloneFingerprints: {},
      };
    }
    if (!store.automationEvents) store.automationEvents = [];
  }

  if (fromVersion < 12) {
    store.automation = store.automation || {};
    if (!Array.isArray(store.automation.autofetchClusterIds)) {
      store.automation.autofetchClusterIds = [];
    }
  }

  if (fromVersion < 14) {
    migrateToV13(store);
  }

  if (fromVersion < 15) {
    migrateToV8(store);
  }

  store.plans = (store.plans || []).map(normalizePlan);
  store.version = STORE_VERSION;
  return store;
}

function migrateToV13(store) {
  const ids = [...new Set((store.clusters || []).map(c => c.id))];
  store.clusters = [];
  store.plans = [];
  store.warehouse = [];
  store.history = [];
  store.snapshots = [];
  store.fetches = [];
  store.ingestionFailures = [];
  store.automationEvents = [];
  store.automation = {
    enabled: true,
    pollIntervalMs: 30000,
    lastCheckAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    autoTransform: true,
    promoteOnPublished: true,
    targetClusterIds: [],
    autofetchClusterIds: [],
    cloneFingerprints: {},
    lastSyncedFingerprints: {},
  };
  for (const id of ids) {
    try { clearTransformData(id); } catch { /* ignore missing index */ }
    const dir = path.join(UPLOADS_ROOT, id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function migrateToV9(store) {
  const sandboxPlanIds = new Set(
    (store.plans || [])
      .filter(p => p.clusterId === C1_CLUSTER_ID && /^sandbox_/.test(p.id))
      .map(p => p.id)
  );
  if (sandboxPlanIds.size === 0) return;

  store.plans = (store.plans || []).filter(p => !sandboxPlanIds.has(p.id));
  store.warehouse = (store.warehouse || []).filter(
    w => !(w.clusterId === C1_CLUSTER_ID && w.planId && sandboxPlanIds.has(w.planId))
  );
  store.history = (store.history || []).filter(
    h => !(h.clusterId === C1_CLUSTER_ID && h.planId && sandboxPlanIds.has(h.planId))
  );
  store.snapshots = (store.snapshots || []).filter(
    s => !sandboxPlanIds.has(s.planId)
  );
}

function migrateToV8(store) {
  const clusterIds = (store.clusters || []).map(c => c.id);
  for (const clusterId of clusterIds) {
    for (const sp of buildPlansForCluster(clusterId)) {
      if (!store.plans.find(p => p.id === sp.id)) {
        store.plans.push(sp);
      }
    }
  }
}

export function getStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const def = loadDefault();
    updateClusterFileCounts(def);
    fs.writeFileSync(STORE_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  if (!store.version || store.version < STORE_VERSION) {
    const migrated = migrateStore(store);
    updateClusterFileCounts(migrated);
    fs.writeFileSync(STORE_PATH, JSON.stringify(migrated, null, 2));
    return migrated;
  }
  store.plans = (store.plans || []).map(normalizePlan);
  const needsCatalog = (store.warehouse || []).some(w => !w.catalog?.content_sha256);
  if (needsCatalog) {
    backfillWarehouseCatalog(store);
    updateClusterFileCounts(store);
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}

export function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.version = STORE_VERSION;
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export function updateClusterFileCounts(store) {
  for (const c of store.clusters) {
    c.fileCount = store.warehouse.filter(w => w.clusterId === c.id).length;
  }
}

export function resetStore() {
  const def = loadDefault();
  saveStore(def);
  return def;
}
