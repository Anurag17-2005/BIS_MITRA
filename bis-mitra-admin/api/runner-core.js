import { executePlan, warehouseItemsFromIngest } from './runner.js';
import { sectionForPlan } from './sections.js';
import {
  recordFetch,
  recordIngestionFailure,
  stampCatalog,
  sha256,
  mimeForType,
  detectContentChange,
  resolveItemBytes,
} from './provenance.js';
import { stampRegulatoryOnItem } from './regulatory-stamp.js';

export function pushSnapshot(store, plan) {
  if (!store.snapshots) store.snapshots = [];
  const items = store.warehouse.filter(
    w => w.clusterId === plan.clusterId && w.planId === plan.id && w.source !== 'upload'
  );
  const snap = {
    id: `snap-${Date.now()}-${plan.id}`,
    planId: plan.id,
    clusterId: plan.clusterId,
    at: new Date().toISOString(),
    items: JSON.parse(JSON.stringify(items)),
  };
  const rest = store.snapshots.filter(s => s.planId !== plan.id);
  const mine = [snap, ...store.snapshots.filter(s => s.planId === plan.id)].slice(0, 2);
  store.snapshots = [...mine, ...rest];
}

export function rollbackPlan(store, planId) {
  const plan = store.plans.find(p => p.id === planId);
  if (!plan) throw new Error('Plan not found');
  const snaps = (store.snapshots || []).filter(s => s.planId === planId);
  if (!snaps.length) throw new Error('No previous snapshot for this plan');
  const [latest] = snaps;
  store.warehouse = store.warehouse.filter(
    w => !(w.clusterId === plan.clusterId && w.planId === plan.id && w.source !== 'upload')
  );
  for (const item of latest.items) {
    store.warehouse.push(item);
  }
  store.snapshots = (store.snapshots || []).filter(s => s.id !== latest.id);
  return { restored: latest.items.length, at: latest.at };
}

export function replaceWarehouseForPlan(store, plan, newItems) {
  const sourceKey = plan.id;
  store.warehouse = store.warehouse.filter(
    w => !(
      w.clusterId === plan.clusterId
      && w.source !== 'upload'
      && (w.sourceKey === sourceKey || w.planId === plan.id)
    )
  );
  for (const item of newItems) {
    item.clusterId = plan.clusterId;
    item.sourceKey = sourceKey;
    store.warehouse.push(item);
  }
}

function previousPlanCatalog(store, plan) {
  const prev = (store.warehouse || []).find(
    w => w.clusterId === plan.clusterId && w.planId === plan.id && w.source !== 'upload'
  );
  return prev?.catalog || null;
}

export async function runPlanInternal(store, planId, selectedQueries) {
  const plan = store.plans.find(p => p.id === planId);
  if (!plan) throw new Error('Plan not found');
  const queries = selectedQueries || plan.queries;
  const runAt = new Date().toISOString();

  const prevCat = previousPlanCatalog(store, plan);
  if (prevCat?.etag || prevCat?.last_modified) {
    plan._conditionalHeaders = {
      etag: prevCat.etag || null,
      lastModified: prevCat.last_modified || null,
    };
  }

  const runResult = await executePlan(plan, queries);
  delete plan._conditionalHeaders;

  const success = runResult.success;
  plan.lastStatus = success ? 'success' : 'failed';
  plan.lastRunAt = runAt;
  plan.lastResult = runResult;
  const historyEntry = {
    id: `h-${Date.now()}-${planId}`,
    planId: plan.id,
    planName: plan.name,
    clusterId: plan.clusterId,
    section: sectionForPlan(plan) || '—',
    kind: plan.kind,
    method: plan.method,
    status: success ? 'success' : 'failed',
    fetchedAt: runAt,
    storedInWarehouse: false,
    unchanged: false,
    payload: runResult,
  };
  if (plan.kind === 'ingest' && success) {
    const firstPayload = runResult.results?.[0]?.payload;
    if (firstPayload?.notModified || firstPayload?._http?.notModified) {
      historyEntry.unchanged = true;
      historyEntry.storedInWarehouse = false;
      historyEntry.note = 'HTTP 304 / ETag match — warehouse kept';
      for (const w of store.warehouse || []) {
        if (w.clusterId === plan.clusterId && w.planId === plan.id && w.source !== 'upload' && w.catalog) {
          w.catalog.fetched_at = runAt;
          w.updatedAt = runAt;
        }
      }
    } else {
      pushSnapshot(store, plan);
      const newItems = warehouseItemsFromIngest(plan, runResult);
      const startedAt = runAt;
      const finishedAt = new Date().toISOString();
      const sourceId = plan.connector || plan.id;
      const manifestArtifacts = [];
      let allUnchanged = newItems.length > 0;

      for (const item of newItems) {
        const buf = item.content != null
          ? Buffer.from(JSON.stringify(item.content), 'utf8')
          : resolveItemBytes(item);
        const contentSha = buf ? sha256(buf) : null;
        const canonical = item.meta?.sourceUrl || `plan://${plan.id}/${item.name}`;
        const change = detectContentChange(store, plan.clusterId, canonical, contentSha);
        if (change.changed) allUnchanged = false;

        const http = firstPayload?._http || {};
        stampCatalog(item, plan, {
          buffer: buf,
          fetch_id: null,
          canonical_url: canonical,
          fetched_at: finishedAt,
          etag: http.etag || null,
          last_modified: http.lastModified || null,
          version: change.previous
            ? (change.previous.catalog?.version || 1) + (change.changed ? 1 : 0)
            : 1,
        });
        stampRegulatoryOnItem(item, plan);
        manifestArtifacts.push({
          artifact_id: item.id,
          fileName: item.name,
          sha256: contentSha || item.catalog?.content_sha256,
          mime_type: mimeForType(item.type, item.name),
          bytes: buf?.length,
          url: item.catalog?.canonical_url,
          storagePath: item.storagePath,
          buffer: buf || undefined,
        });
      }

      if (allUnchanged && newItems.length) {
        historyEntry.unchanged = true;
        historyEntry.note = 'SHA unchanged — warehouse kept';
        const newIds = new Set(newItems.map(i => i.id));
        store.warehouse = (store.warehouse || []).filter(w => {
          if (w.clusterId !== plan.clusterId || w.planId !== plan.id || w.source === 'upload') {
            return true;
          }
          return newIds.has(w.id);
        });
        for (const w of store.warehouse || []) {
          if (w.clusterId === plan.clusterId && w.planId === plan.id && w.source !== 'upload' && w.catalog) {
            w.catalog.fetched_at = finishedAt;
            if (firstPayload?._http?.etag) w.catalog.etag = firstPayload._http.etag;
            if (firstPayload?._http?.lastModified) {
              w.catalog.last_modified = firstPayload._http.lastModified;
            }
            w.updatedAt = finishedAt;
          }
        }
      } else {
        const { fetchId } = recordFetch(store, {
          clusterId: plan.clusterId,
          planId: plan.id,
          sourceId,
          startedAt,
          finishedAt,
          seedUrls: [`plan://${plan.id}`],
          artifacts: manifestArtifacts,
          errors: [],
        });

        for (const item of newItems) {
          item.catalog.fetch_id = fetchId;
        }

        replaceWarehouseForPlan(store, plan, newItems);
        historyEntry.storedInWarehouse = newItems.length > 0;
        historyEntry.fetchId = fetchId;
      }
    }
  } else if (!success) {
    recordIngestionFailure(store, {
      planId: plan.id,
      clusterId: plan.clusterId,
      error: runResult.error || 'ingest failed',
    });
  }
  store.history.unshift(historyEntry);
  return { plan, runResult, historyEntry };
}
