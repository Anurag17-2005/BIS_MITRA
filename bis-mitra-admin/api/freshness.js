import { cloneSyncMeta } from './clone-db.js';
import { warehouseFingerprint } from './runner.js';
import { SECTIONS } from './sections.js';

const DOMAIN_META = {
  news: 'news',
  standards: 'standards',
  manuals: 'manuals',
  fees: 'fees',
  process: 'process',
  schemes: 'schemes',
  hallmarking: 'hallmarking',
  labs: 'labs',
  consumer: 'consumer',
};

export function sectionFreshness(store, clusterId) {
  let clone = null;
  let cloneError = null;
  try {
    clone = cloneSyncMeta();
  } catch (err) {
    cloneError = err.message;
  }

  const items = store.warehouse.filter(w => w.clusterId === clusterId);
  const plans = store.plans.filter(p => p.clusterId === clusterId && p.kind === 'ingest');

  return SECTIONS.map(sec => {
    const sectionItems = items.filter(i => i.domain === sec.id);
    const fetched = sectionItems.filter(i => i.source !== 'upload');
    const lastUpdated = fetched.reduce((acc, i) => (!acc || i.updatedAt > acc) ? i.updatedAt : acc, null);
    const plan = plans.find(p => p.section === sec.id);
    const cloneKey = DOMAIN_META[sec.id];
    const clonePart = clone?.[cloneKey];
    const fp = warehouseFingerprint(sectionItems, sec.id);
    let state = 'empty';
    if (fetched.length) {
      state = 'current';
      if (clonePart && clonePart.fingerprint && fp && clonePart.fingerprint.split(':')[0] !== fp.split(':')[0]) {
        state = 'stale';
      }
    }
    return {
      id: sec.id,
      title: sec.title,
      fileCount: sectionItems.length,
      fetchedCount: fetched.length,
      lastFetchedAt: lastUpdated || plan?.lastRunAt || null,
      lastStatus: plan?.lastStatus || null,
      planId: plan?.id || null,
      method: plan?.method || 'api',
      state,
      cloneCount: clonePart?.count ?? null,
      cloneError,
    };
  });
}
