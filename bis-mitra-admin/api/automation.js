import { sectionFreshness } from './freshness.js';
import { runPlanInternal } from './runner-core.js';
import { ingestPlanIdForSection } from './sections.js';
import { cloneSyncMeta } from './clone-db.js';
import {
  runIncrementalTransform,
  promoteIndexToLive,
} from './transformation/service.js';

const MAX_EVENTS = 80;
const DOMAINS = ['news', 'standards', 'manuals', 'fees', 'process', 'schemes', 'hallmarking', 'labs', 'consumer'];

export function defaultAutomationConfig() {
  return {
    enabled: true,
    pollIntervalMs: 30000,
    lastCheckAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    autoTransform: true,
    promoteOnPublished: true,
    /** @deprecated use autofetchClusterIds */
    targetClusterIds: [],
    /** Only these cluster IDs participate in automatic polling/sync */
    autofetchClusterIds: [],
    /** Clone fingerprints after a successful fetch of that domain — never updated on mere check */
    lastSyncedFingerprints: {},
  };
}

export function appendAutomationEvent(store, event) {
  if (!store.automationEvents) store.automationEvents = [];
  store.automationEvents.unshift({
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...event,
  });
  store.automationEvents = store.automationEvents.slice(0, MAX_EVENTS);
}

export function getStaleSections(store, clusterId) {
  return sectionFreshness(store, clusterId).filter(s => s.state === 'stale' && s.planId);
}

/**
 * Read live clone fingerprints. Does NOT write them into the store.
 * "changed" = live differs from last successful sync baseline.
 */
export function peekCloneDelta(store) {
  let clone = null;
  let error = null;
  try {
    clone = cloneSyncMeta();
  } catch (err) {
    error = err.message;
  }
  const synced = store.automation?.lastSyncedFingerprints || {};
  const changed = [];
  if (clone) {
    for (const key of DOMAINS) {
      const live = clone[key]?.fingerprint;
      const base = synced[key];
      if (live && base && live !== base) changed.push(key);
      // First-time: no baseline yet — treat as changed only if warehouse section is stale
    }
  }
  return { clone, error, changedDomains: changed };
}

function markDomainSynced(store, domain, fingerprint) {
  store.automation = store.automation || defaultAutomationConfig();
  store.automation.lastSyncedFingerprints = {
    ...(store.automation.lastSyncedFingerprints || {}),
    [domain]: fingerprint,
  };
}

/** Domains that need fetch: clone moved ahead of last sync, or never synced. */
export function domainsNeedingFetch(store, clusterId, cloneDelta = null) {
  const delta = cloneDelta || peekCloneDelta(store);
  const synced = store.automation?.lastSyncedFingerprints || {};
  const needing = new Set();

  for (const d of delta.changedDomains) needing.add(d);

  if (delta.clone) {
    for (const key of DOMAINS) {
      const live = delta.clone[key]?.fingerprint;
      const base = synced[key];
      if (live && !base) needing.add(key);
    }
  }

  const stale = new Set(getStaleSections(store, clusterId).map(s => s.id));
  if (delta.clone) {
    for (const key of DOMAINS) {
      const live = delta.clone[key]?.fingerprint;
      const base = synced[key];
      if (live && base && live === base && stale.has(key)) needing.add(key);
    }
  }

  return [...needing];
}

export function clusterAllowsDomainFetch(_store, _clusterId, _domain) {
  return true;
}

export function filterDomainsForCluster(store, clusterId, domains) {
  return domains.filter(d => clusterAllowsDomainFetch(store, clusterId, d));
}

function resolveTargetClusters(store) {
  const cfg = store.automation || {};
  const enabled = cfg.autofetchClusterIds?.length
    ? cfg.autofetchClusterIds
    : (cfg.targetClusterIds?.length ? cfg.targetClusterIds : []);
  return [...new Set(enabled)].filter(id => store.clusters.some(c => c.id === id));
}

/**
 * Fetch ONLY the listed domains (changed/stale), then incremental transform.
 */
export async function runAutoSync(store, {
  reason = 'manual',
  clusterId = null,
  domains = null,
} = {}) {
  const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
  store.automation = cfg;
  const targets = clusterId ? [clusterId] : resolveTargetClusters(store);
  const cloneDelta = peekCloneDelta(store);

  const summary = {
    reason,
    startedAt: new Date().toISOString(),
    cloneDelta: { changedDomains: cloneDelta.changedDomains },
    clusters: [],
  };

  appendAutomationEvent(store, {
    type: 'sync_start',
    kind: 'sync',
    reason,
    domains: domains || cloneDelta.changedDomains,
    clusters: targets,
  });

  for (const cid of targets) {
    const clusterResult = {
      clusterId: cid,
      domains: [],
      fetchedPlans: [],
      transform: null,
      promoted: false,
      errors: [],
    };

    const toFetch = filterDomainsForCluster(
      store,
      cid,
      domains?.length
        ? domains.filter(d => DOMAINS.includes(d))
        : domainsNeedingFetch(store, cid, cloneDelta),
    );

    clusterResult.domains = toFetch;

    for (const sectionId of toFetch) {
      const planId = ingestPlanIdForSection(cid, sectionId)
        || store.plans.find(p => p.clusterId === cid && p.section === sectionId && p.kind === 'ingest')?.id;
      if (!planId) continue;
      try {
        const out = await runPlanInternal(store, planId);
        clusterResult.fetchedPlans.push({
          planId,
          section: sectionId,
          status: out.plan?.lastStatus,
        });
        appendAutomationEvent(store, {
          type: 'fetch',
          kind: 'sync',
          clusterId: cid,
          section: sectionId,
          planId,
          status: out.plan?.lastStatus || 'unknown',
          trigger: reason,
        });
        // Baseline only after successful fetch of this domain
        if (out.plan?.lastStatus === 'success' && cloneDelta.clone?.[sectionId]?.fingerprint) {
          markDomainSynced(store, sectionId, cloneDelta.clone[sectionId].fingerprint);
        }
      } catch (err) {
        clusterResult.errors.push({ section: sectionId, error: err.message });
        appendAutomationEvent(store, {
          type: 'fetch_error',
          kind: 'sync',
          clusterId: cid,
          section: sectionId,
          error: err.message,
          trigger: reason,
        });
      }
    }

    if (cfg.autoTransform && (clusterResult.fetchedPlans.length > 0 || reason === 'transform_only')) {
      try {
        const transform = await runIncrementalTransform(cid);
        clusterResult.transform = transform;
        appendAutomationEvent(store, {
          type: 'transform',
          kind: 'sync',
          clusterId: cid,
          changedItems: transform.changedItemIds?.length || 0,
          chunks: transform.chunks?.chunkCount,
          index: transform.index?.chunkCount,
          trigger: reason,
        });

        const cluster = store.clusters.find(c => c.id === cid);
        if (cfg.promoteOnPublished && cluster?.published) {
          promoteIndexToLive(cid);
          clusterResult.promoted = true;
          appendAutomationEvent(store, {
            type: 'promote',
            kind: 'sync',
            clusterId: cid,
            trigger: reason,
          });
        }
      } catch (err) {
        clusterResult.errors.push({ stage: 'transform', error: err.message });
        appendAutomationEvent(store, {
          type: 'transform_error',
          kind: 'sync',
          clusterId: cid,
          error: err.message,
          trigger: reason,
        });
      }
    }

    summary.clusters.push(clusterResult);
  }

  summary.finishedAt = new Date().toISOString();
  summary.lastRunStatus = summary.clusters.some(c => c.errors.length) ? 'partial' : 'ok';

  cfg.lastRunAt = summary.finishedAt;
  cfg.lastRunStatus = summary.lastRunStatus;
  store.automation = cfg;

  appendAutomationEvent(store, {
    type: 'sync_complete',
    kind: 'sync',
    reason,
    status: summary.lastRunStatus,
    fetched: summary.clusters.reduce((n, c) => n + c.fetchedPlans.length, 0),
    transformed: summary.clusters.filter(c => c.transform).length,
  });

  return summary;
}

export function getAutomationStatus(store) {
  const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
  // migrate old cloneFingerprints → lastSyncedFingerprints once
  if (!cfg.lastSyncedFingerprints?.news && cfg.cloneFingerprints) {
    cfg.lastSyncedFingerprints = { ...cfg.cloneFingerprints };
  }

  const targets = resolveTargetClusters(store);
  const staleByCluster = {};
  for (const cid of targets) {
    staleByCluster[cid] = getStaleSections(store, cid);
  }

  let liveClone = null;
  let cloneError = null;
  try {
    liveClone = cloneSyncMeta();
  } catch (err) {
    cloneError = err.message;
  }

  const synced = cfg.lastSyncedFingerprints || {};
  const fingerprintWatch = DOMAINS.map(key => {
    const live = liveClone?.[key]?.fingerprint || null;
    const base = synced[key] || null;
    const cloneAhead = !!(live && base && live !== base);
    const neverSynced = !!(live && !base);
    const needsUpdate = cloneAhead || neverSynced;
    return {
      domain: key,
      storedFingerprint: base,
      liveFingerprint: live,
      liveCount: liveClone?.[key]?.count ?? null,
      changed: needsUpdate,
      needsUpdate,
      cloneAhead,
      rawBehind: false,
      watching: neverSynced,
      status: !live ? '—' : needsUpdate ? 'needs update' : 'ok',
    };
  });

  return {
    config: cfg,
    events: (store.automationEvents || []).slice(0, 40),
    staleByCluster,
    lastSyncedFingerprints: synced,
    fingerprintWatch,
    cloneError,
    targetClusters: targets,
    clusters: store.clusters.map(c => ({ id: c.id, name: c.name, published: c.published })),
    clusterNames: store.clusters.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {}),
  };
}

export async function runPostIngestTransform(store, clusterId, warehouseItemIds = [], reason = 'warehouse_change') {
  const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
  if (!cfg.autoTransform) return null;

  appendAutomationEvent(store, {
    type: 'transform_queued',
    kind: 'sync',
    clusterId,
    itemCount: warehouseItemIds.length,
    trigger: reason,
  });

  try {
    const transform = await runIncrementalTransform(clusterId, {
      warehouseItemIds: warehouseItemIds.length ? warehouseItemIds : undefined,
    });
    appendAutomationEvent(store, {
      type: 'transform',
      kind: 'sync',
      clusterId,
      changedItems: transform.changedItemIds?.length || 0,
      chunks: transform.chunks?.chunkCount,
      index: transform.index?.chunkCount,
      skippedGolden: transform.skippedGolden,
      trigger: reason,
    });

    const cluster = store.clusters.find(c => c.id === clusterId);
    if (cfg.promoteOnPublished && cluster?.published) {
      promoteIndexToLive(clusterId);
      appendAutomationEvent(store, { type: 'promote', kind: 'sync', clusterId, trigger: reason });
    }
    return transform;
  } catch (err) {
    appendAutomationEvent(store, {
      type: 'transform_error',
      kind: 'sync',
      clusterId,
      error: err.message,
      trigger: reason,
    });
    throw err;
  }
}

let syncInFlight = false;

export function startAutoSyncWatcher(getStore, saveStore, intervalMs = 30000) {
  console.log(`Auto-sync watcher started (every ${intervalMs / 1000}s)`);

  const tick = async () => {
    const store = getStore();
    const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
    store.automation = cfg;
    cfg.lastCheckAt = new Date().toISOString();

    const cloneDelta = peekCloneDelta(store);
    const targets = resolveTargetClusters(store);
    const needing = new Set();
    if (targets.length > 0) {
      for (const d of cloneDelta.changedDomains) needing.add(d);
      for (const cid of targets) {
        for (const d of filterDomainsForCluster(
          store,
          cid,
          domainsNeedingFetch(store, cid, cloneDelta),
        )) {
          needing.add(d);
        }
      }
    }
    const domainList = [...needing];

    // Log checks: always when domains need update; otherwise keep one latest "in sync" check
    const checkEv = {
      type: 'check',
      kind: 'check',
      changedDomains: cloneDelta.changedDomains,
      needingFetch: domainList,
      enabled: cfg.enabled,
    };
    if (domainList.length > 0) {
      appendAutomationEvent(store, checkEv);
    } else {
      const evs = store.automationEvents || [];
      const last = evs[0];
      if (!(last?.type === 'check' && !(last.needingFetch?.length))) {
        appendAutomationEvent(store, checkEv);
      } else {
        // refresh timestamp on the existing ok-check
        last.at = cfg.lastCheckAt;
      }
    }

    if (cfg.enabled && targets.length > 0 && domainList.length > 0 && !syncInFlight) {
      syncInFlight = true;
      try {
        await runAutoSync(store, {
          reason: cloneDelta.changedDomains.length ? 'clone_change' : 'stale_section',
          domains: domainList,
        });
      } catch (err) {
        appendAutomationEvent(store, {
          type: 'sync_error',
          kind: 'sync',
          error: err.message,
        });
        console.error('[auto-sync]', err.message);
      } finally {
        syncInFlight = false;
      }
    }

    saveStore(store);
  };

  tick();
  return setInterval(tick, intervalMs);
}
