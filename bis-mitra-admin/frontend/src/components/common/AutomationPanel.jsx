import { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function eventLabel(ev) {
  switch (ev.type) {
    case 'check': {
      const n = ev.needingFetch?.length || 0;
      if (n) return `Check · ${n} domain(s) need update (${(ev.needingFetch || []).join(', ')})`;
      return 'Check · all in sync';
    }
    case 'sync_start': return `Sync started${ev.domains?.length ? ` · ${ev.domains.join(', ')}` : ''}`;
    case 'sync_error': return `Sync error: ${ev.error}`;
    case 'sync_complete': return `Sync done (${ev.status}) · fetched ${ev.fetched ?? 0}`;
    case 'fetch': return `Fetch · ${ev.section}`;
    case 'fetch_error': return `Fetch failed · ${ev.section}`;
    case 'transform': return `Transform · ${ev.changedItems ?? 0} files → ${ev.chunks ?? '?'} chunks`;
    case 'transform_queued': return 'Transform queued';
    case 'transform_error': return 'Transform error';
    case 'promote': return 'Index promoted';
    default: return ev.type;
  }
}

export default function AutomationPanel() {
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [logKind, setLogKind] = useState('all');
  const [logCluster, setLogCluster] = useState('all');
  const [selectedCluster, setSelectedCluster] = useState('');

  const reload = useCallback(async () => {
    try {
      const next = await api.getAutomationStatus();
      setStatus(next);
      const enabled = next.config?.autofetchClusterIds || next.config?.targetClusterIds || [];
      setSelectedCluster(prev => prev || enabled[0] || next.clusters?.[0]?.id || '');
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, 8000);
    return () => clearInterval(id);
  }, [reload]);

  if (!status) return <p className="row-sub">Loading…</p>;

  const cfg = status.config;
  const enabledClusters = cfg.autofetchClusterIds || cfg.targetClusterIds || [];
  const needing = (status.fingerprintWatch || []).filter(r => r.needsUpdate);
  const events = (status.events || []).filter(ev => {
    if (logKind === 'check' && ev.kind !== 'check' && ev.type !== 'check') return false;
    if (logKind === 'sync' && ev.kind === 'check') return false;
    if (logCluster !== 'all' && ev.clusterId && ev.clusterId !== logCluster) return false;
    return true;
  }).slice(0, 25);

  const setAutofetch = async () => {
    if (!selectedCluster) return;
    await api.patchAutomation({ autofetchClusterIds: [selectedCluster] });
    await reload();
  };

  return (
    <div className="automation-panel">
      <div className="automation-header">
        <div className="automation-actions">
          <button
            type="button"
            className={`btn btn-sm ${cfg.enabled ? 'btn-primary' : ''}`}
            onClick={async () => { await api.patchAutomation({ enabled: !cfg.enabled }); reload(); }}
          >
            Global {cfg.enabled ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={running || !enabledClusters.length}
            onClick={async () => {
              setRunning(true);
              try { await api.runAutomationNow(); await reload(); }
              finally { setRunning(false); }
            }}
          >
            {running ? '…' : 'Run now'}
          </button>
        </div>
      </div>

      <section className="auto-cluster-enable">
        <h3 className="row-sub" style={{ marginBottom: 8 }}>Autofetch cluster</h3>
        <p className="row-sub" style={{ marginBottom: 10 }}>
          Choose a cluster, then click Set autofetch. That cluster syncs when BIS portal data changes.
        </p>
        <div className="auto-cluster-set">
          <select
            className="wh-filter"
            value={selectedCluster}
            onChange={e => setSelectedCluster(e.target.value)}
            disabled={!(status.clusters || []).length}
          >
            {(status.clusters || []).length === 0 && <option value="">No clusters</option>}
            {(status.clusters || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!selectedCluster}
            onClick={setAutofetch}
          >
            Set autofetch
          </button>
        </div>
      </section>

      <div className="automation-meta">
        <div><span className="auto-card-label">Last check</span> {formatTime(cfg.lastCheckAt)}</div>
        <div><span className="auto-card-label">Last sync</span> {formatTime(cfg.lastRunAt)}{cfg.lastRunStatus ? ` · ${cfg.lastRunStatus}` : ''}</div>
        <div>
          <span className="auto-card-label">Needs update</span>{' '}
          {needing.length ? needing.map(r => r.domain).join(', ') : 'none'}
        </div>
        <div>
          <span className="auto-card-label">Active target</span>{' '}
          {enabledClusters.length ? enabledClusters.map(id => status.clusterNames?.[id] || id).join(', ') : 'none set'}
        </div>
      </div>

      <table className="auto-table">
        <thead>
          <tr><th>Domain</th><th>BIS count</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(status.fingerprintWatch || []).map(row => (
            <tr key={row.domain}>
              <td>{row.domain}</td>
              <td>{row.liveCount ?? '—'}</td>
              <td>
                {row.status === 'needs update' && <span className="badge badge-fail">needs update</span>}
                {row.status === 'ok' && <span className="badge badge-ok">ok</span>}
                {row.status === '—' && <span className="badge">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="auto-log-filters">
        <label className="row-sub">Logs</label>
        <select className="wh-filter" style={{ maxWidth: 120 }} value={logKind} onChange={e => setLogKind(e.target.value)}>
          <option value="all">All</option>
          <option value="check">Checks</option>
          <option value="sync">Syncs</option>
        </select>
        <select className="wh-filter" style={{ maxWidth: 180 }} value={logCluster} onChange={e => setLogCluster(e.target.value)}>
          <option value="all">All clusters</option>
          {(status.clusters || []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <ul className="auto-event-list">
        {events.length === 0 && <li className="row-sub">No events</li>}
        {events.map(ev => (
          <li key={ev.id}>
            <span className="auto-ev-time">{new Date(ev.at).toLocaleTimeString()}</span>
            <span className={`chip ${ev.kind === 'check' || ev.type === 'check' ? '' : 'chip-ok'}`}>
              {ev.kind === 'check' || ev.type === 'check' ? 'check' : 'sync'}
            </span>
            <span className="auto-ev-msg">{eventLabel(ev)}</span>
            {ev.clusterId && <span className="chip">{status.clusterNames?.[ev.clusterId] || ev.clusterId}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
