import { listChangedWarehouseItems } from './transformation/pipeline/run-incremental.js';
import { getTransformStatus } from './transformation/service.js';

/** @type {Map<string, object>} */
const activeJobs = new Map();

export function startPipelineJob(clusterId, { total = 0, phase = 'starting', reason = 'manual' } = {}) {
  const job = {
    clusterId,
    status: 'running',
    phase,
    done: 0,
    total: Math.max(0, total),
    percent: 0,
    reason,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  activeJobs.set(clusterId, job);
  return job;
}

export function updatePipelineJob(clusterId, patch) {
  const job = activeJobs.get(clusterId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  if (typeof job.done === 'number' && job.total > 0) {
    job.percent = Math.min(100, Math.round((job.done / job.total) * 100));
  }
  return job;
}

export function finishPipelineJob(clusterId, { status = 'ok', error = null } = {}) {
  const job = activeJobs.get(clusterId);
  if (!job) return null;
  job.status = status;
  job.error = error;
  job.phase = status === 'ok' ? 'complete' : 'error';
  job.percent = status === 'ok' ? 100 : job.percent;
  job.finishedAt = new Date().toISOString();
  job.updatedAt = job.finishedAt;
  setTimeout(() => {
    if (activeJobs.get(clusterId) === job && job.status !== 'running') {
      activeJobs.delete(clusterId);
    }
  }, 120_000);
  return job;
}

export function getActivePipelineJob(clusterId) {
  return activeJobs.get(clusterId) || null;
}

export function computeIndexStale(clusterId, store = null) {
  let pending = 0;
  try {
    pending = listChangedWarehouseItems(clusterId, store).length;
  } catch {
    pending = 0;
  }
  let transformReady = false;
  try {
    const st = getTransformStatus(clusterId);
    transformReady = !!st?.ready;
  } catch {
    transformReady = false;
  }
  return {
    clusterId,
    stale: pending > 0,
    pendingWarehouseItems: pending,
    indexReady: transformReady,
    message: pending > 0
      ? `${pending} warehouse item(s) need transform before the agent sees new content`
      : null,
  };
}

export function getPipelineStatus(clusterId = null) {
  const job = clusterId ? getActivePipelineJob(clusterId) : null;
  const stale = clusterId ? computeIndexStale(clusterId) : null;
  return {
    job,
    stale,
    anyRunning: clusterId
      ? job?.status === 'running'
      : [...activeJobs.values()].some(j => j.status === 'running'),
  };
}
