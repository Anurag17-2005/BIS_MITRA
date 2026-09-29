const recent = [];
const MAX = 2000;

export function logStt(event) {
  const row = { ts: new Date().toISOString(), ...event };
  recent.push(row);
  if (recent.length > MAX) recent.shift();
  console.log('[stt]', JSON.stringify(row));
}

export function sttMetricsSummary() {
  const window = recent.slice(-500);
  const byProvider = {};
  for (const row of window) {
    const key = row.provider || 'unknown';
    if (!byProvider[key]) {
      byProvider[key] = { ok: 0, err: 0, latencyMs: [] };
    }
    if (row.ok) {
      byProvider[key].ok += 1;
      if (typeof row.ms === 'number') byProvider[key].latencyMs.push(row.ms);
    } else {
      byProvider[key].err += 1;
    }
  }
  const providers = {};
  for (const [name, stats] of Object.entries(byProvider)) {
    const lat = stats.latencyMs;
    const avgMs = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null;
    providers[name] = {
      success: stats.ok,
      errors: stats.err,
      avgLatencyMs: avgMs,
    };
  }
  return { sampleSize: window.length, providers };
}
