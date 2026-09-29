import { getStore, saveStore, updateClusterFileCounts } from './store.js';
import { runPlanInternal } from './runner-core.js';
import { runPostIngestTransform } from './automation.js';

function localParts(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return {
    dateKey: `${y}-${m}-${d}`,
    time: `${hh}:${mm}`,
    fireKey: `${y}-${m}-${d}T${hh}:${mm}`,
    dayOfWeek: date.getDay(), // 0=Sun … 6=Sat
    dayOfMonth: date.getDate(),
    monthKey: `${y}-${m}`,
  };
}

/**
 * Does this schedule fire at the current local clock tick?
 * frequency: daily | weekly | monthly (default daily)
 * weekly → dayOfWeek 0–6
 * monthly → dayOfMonth 1–31
 */
export function scheduleMatchesNow(sched, now = new Date()) {
  if (!sched?.enabled || !sched.time) return false;
  const parts = localParts(now);
  if (sched.time !== parts.time) return false;

  const freq = sched.frequency || 'daily';
  if (freq === 'weekly') {
    const want = sched.dayOfWeek ?? 1;
    if (parts.dayOfWeek !== Number(want)) return false;
  } else if (freq === 'monthly') {
    const want = sched.dayOfMonth ?? 1;
    if (parts.dayOfMonth !== Number(want)) return false;
  }
  // daily: time match is enough

  if (sched.lastFiredKey === parts.fireKey) return false;
  return true;
}

export function fireKeyForNow(now = new Date()) {
  return localParts(now).fireKey;
}

/**
 * Poll every 15s. Runs plans whose schedule matches current time (+ day/date for week/month).
 */
export function startScheduler(intervalMs = 15000) {
  console.log(`Plan scheduler started (every ${intervalMs / 1000}s)`);
  const tick = async () => {
    const store = getStore();
    let changed = false;
    const ingestedClusters = new Set();

    for (const plan of store.plans) {
      const sched = plan.schedule;
      if (!scheduleMatchesNow(sched)) continue;
      const key = fireKeyForNow();
      try {
        console.log(`[scheduler] Running ${plan.name} (${sched.frequency || 'daily'} @ ${sched.time})`);
        await runPlanInternal(store, plan.id);
        plan.schedule.lastFiredKey = key;
        changed = true;
        if (plan.kind === 'ingest') ingestedClusters.add(plan.clusterId);
      } catch (err) {
        console.error(`[scheduler] ${plan.name} failed:`, err.message);
        plan.schedule.lastFiredKey = key;
        plan.lastStatus = 'failed';
        plan.lastRunAt = new Date().toISOString();
        changed = true;
      }
    }

    for (const clusterId of ingestedClusters) {
      try {
        await runPostIngestTransform(store, clusterId, [], 'scheduled_fetch');
      } catch (err) {
        console.error(`[scheduler→transform] ${clusterId}:`, err.message);
      }
    }

    if (changed) {
      if (store.history.length > 200) store.history = store.history.slice(0, 200);
      updateClusterFileCounts(store);
      saveStore(store);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
