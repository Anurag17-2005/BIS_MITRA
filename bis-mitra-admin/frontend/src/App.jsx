import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from './components/common/Modal';
import SectionWarehouse from './components/transform/SectionWarehouse';
import AppNav from './components/common/AppNav';
import TransformConsole from './components/transform/TransformConsole';
import AgentConsole from './components/agent/AgentConsole';
import LineagePanel from './components/common/LineagePanel';
import TrustStrip from './components/common/TrustStrip';
import HealthStrip from './components/common/HealthStrip';
import AutomationConsole from './components/common/AutomationConsole';
import RulesConsole from './components/rules/RulesConsole';
import PlanHover from './components/common/PlanHover';
import JsonPreview from './components/common/JsonPreview';
import * as api from './api';
import { SECTIONS, sectionForPlan } from './sections';
import { methodLabel, methodOptionsForPlan, FETCH_METHODS } from './methods';
import { warehouseViewUrl, isPdfItem, isJsonItem, isImageItem } from './fileUrls';

const KIND_FILTERS = ['All', 'ingest', 'probe'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSchedule(sched) {
  if (!sched) return 'Off';
  if (typeof sched === 'string') return sched;
  if (!sched.enabled) return 'Off';
  const freq = sched.frequency || 'daily';
  const t = sched.time || '02:00';
  if (freq === 'weekly') return `Weekly ${WEEKDAYS[sched.dayOfWeek ?? 1]} ${t}`;
  if (freq === 'monthly') return `Monthly day ${sched.dayOfMonth ?? 1} ${t}`;
  return `Daily ${t}`;
}

function plusOneMinute() {
  const d = new Date(Date.now() + 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function WarehousePreviewBody({ item }) {
  const url = warehouseViewUrl(item);
  const pdf = isPdfItem(item);
  const json = isJsonItem(item);

  if (pdf && url) {
    return (
      <>
        {(item.meta?.title || item.meta?.is_number) && (
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {item.meta?.is_number && <strong>{item.meta.is_number}</strong>}
            {item.meta?.title && <> — {item.meta.title}</>}
          </p>
        )}
        <div className="pdf-frame-wrap">
          <iframe title={item.name} src={url} className="pdf-frame" />
        </div>
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">Open in new tab</a>
          <a className="btn" href={url} download={item.name}>Download</a>
        </div>
      </>
    );
  }

  if (pdf && !url) {
    return (
      <p className="warn">
        PDF path missing or file not found on disk. Re-run the linked ingest plan, or re-upload the file.
        {item.filePath && <> Path: <code>{item.filePath}</code></>}
      </p>
    );
  }

  if (json && item.content != null) {
    return <JsonPreview content={item.content} />;
  }

  if (isImageItem(item) && url) {
    return (
      <>
        {(item.meta?.title) && (
          <p style={{ fontSize: 13, marginBottom: 8 }}>{item.meta.title}</p>
        )}
        <img src={url} alt={item.name} className="preview-image" />
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">Open in new tab</a>
          <a className="btn" href={url} download={item.name}>Download</a>
        </div>
      </>
    );
  }

  return (
    <div className="preview-box">
      {JSON.stringify(item.meta || { name: item.name, note: item.note }, null, 2)}
    </div>
  );
}

const USER_PORTAL = import.meta.env.VITE_USER_PORTAL_URL || 'http://localhost:5002';

function openUserPortal() {
  window.open(USER_PORTAL, '_blank', 'noopener');
}

export default function App() {
  const [svcStatus, setSvcStatus] = useState(null);
  const [freshness, setFreshness] = useState([]);
  const [whFilter, setWhFilter] = useState('');
  const [skipScript, setSkipScript] = useState(false);
  const [clusters, setClusters] = useState([]);
  const [activeCluster, setActiveCluster] = useState(null);
  const [panel, setPanel] = useState('data');
  const [plans, setPlans] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [history, setHistory] = useState([]);
  const [kindFilter, setKindFilter] = useState('All');
  const [selectedPlans, setSelectedPlans] = useState(new Set());
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const [highlightPlanId, setHighlightPlanId] = useState(null);
  const fileInputRef = useRef(null);

  const [modal, setModal] = useState(null);
  const [runModal, setRunModal] = useState(null);
  const [configModal, setConfigModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [methodModal, setMethodModal] = useState(null);
  const [methodChoice, setMethodChoice] = useState('');
  const [uploadModal, setUploadModal] = useState(null);
  const [uploadDomain, setUploadDomain] = useState('news');
  const [uploadNote, setUploadNote] = useState('');
  const [schedForm, setSchedForm] = useState({
    enabled: true,
    frequency: 'daily',
    time: '02:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
  });
  const [bulkMethod, setBulkMethod] = useState('keep');
  const [runQueries, setRunQueries] = useState({});
  const [createClusterOpen, setCreateClusterOpen] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterDesc, setNewClusterDesc] = useState('');
  const [renameClusterTarget, setRenameClusterTarget] = useState(null);
  const [renameClusterName, setRenameClusterName] = useState('');
  const [renameClusterDesc, setRenameClusterDesc] = useState('');
  const [appSection, setAppSection] = useState(null);
  const [trust, setTrust] = useState(null);
  const [lineage, setLineage] = useState(null);

  const loadClusters = useCallback(async () => {
    const list = await api.getClusters();
    setClusters(Array.isArray(list) ? list : []);
  }, []);

  const loadClusterData = useCallback(async (clusterId) => {
    const [p, w, h, f] = await Promise.all([
      api.getPlans(clusterId),
      api.getWarehouse(clusterId),
      api.getHistory(clusterId),
      api.getFreshness(clusterId).catch(() => []),
    ]);
    setPlans(Array.isArray(p) ? p : []);
    setWarehouse(Array.isArray(w) ? w : []);
    setHistory(Array.isArray(h) ? h : []);
    setFreshness(Array.isArray(f) ? f : []);
  }, []);

  useEffect(() => {
    loadClusters().catch(() => {});
    api.getStatus().then(setSvcStatus).catch(() => {});
    const id = setInterval(() => api.getStatus().then(setSvcStatus).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [loadClusters]);

  useEffect(() => {
    if (activeCluster) {
      loadClusterData(activeCluster.id);
      api.getClusterTrust(activeCluster.id).then(setTrust).catch(() => setTrust(null));
    }
  }, [activeCluster, loadClusterData]);

  useEffect(() => {
    if (!activeCluster) return undefined;
    const id = setInterval(() => loadClusterData(activeCluster.id), 20000);
    return () => clearInterval(id);
  }, [activeCluster, loadClusterData]);

  const openCluster = (c) => {
    setActiveCluster(c);
    setPanel('data');
    setSelectedPlans(new Set());
  };

  const handlePublish = async (published) => {
    if (!activeCluster) return;
    await api.publishCluster(activeCluster.id, published);
    await loadClusters();
    const updated = (await api.getClusters()).find(c => c.id === activeCluster.id);
    setActiveCluster(updated);
  };

  const togglePlan = (id) => {
    setSelectedPlans(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const filteredPlans = plans.filter(p => {
    if (kindFilter === 'All') return true;
    return p.kind === kindFilter;
  });

  const openResult = async (plan) => {
    const { plan: p, history: h } = await api.getPlan(plan.id);
    setModal({ type: 'result', plan: p, history: h });
  };

  const openHistoryEntry = (h) => {
    const plan = plans.find(p => p.id === h.planId);
    setModal({
      type: 'result',
      plan: plan ? { ...plan, lastResult: h.payload, lastRunAt: h.fetchedAt, lastStatus: h.status } : {
        name: h.planName,
        kind: h.kind,
        method: '—',
        lastRunAt: h.fetchedAt,
        lastStatus: h.status,
        lastResult: h.payload,
      },
      history: [h],
    });
  };

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const openLineage = async (item) => {
    setModal({ type: 'lineage', item });
    setLineage(null);
    try {
      setLineage(await api.getWarehouseLineage(item.id));
    } catch {
      setLineage(null);
    }
  };

  const openUpload = (domain) => {
    setUploadDomain(domain);
    setUploadNote('');
    setUploadModal(true);
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeCluster) return;
    try {
      await api.uploadToSection(activeCluster.id, uploadDomain, file, uploadNote);
      await loadClusterData(activeCluster.id);
      setUploadModal(false);
      showToastMsg(`Uploaded ${file.name} → ${uploadDomain} section`);
    } catch (err) {
      alert(err.message || 'Upload failed');
    }
    e.target.value = '';
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Remove ${item.name} from warehouse?`)) return;
    try {
      await api.deleteWarehouseItem(item.id);
      if (activeCluster) await loadClusterData(activeCluster.id);
      showToastMsg(`Removed ${item.name}`);
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  const jumpToPlan = (planId) => {
    setPanel('config');
    setHighlightPlanId(planId);
    setTimeout(() => setHighlightPlanId(null), 2500);
  };

  const openWarehousePreview = (item) => {
    setModal({ type: 'warehouse', item });
  };

  const openMethod = (plan) => {
    const m = plan.method === 'playwright' ? 'script' : (plan.method || 'api');
    setMethodChoice(m);
    setMethodModal(plan);
  };

  const saveMethod = async () => {
    if (!methodModal || !methodChoice) return;
    try {
      await api.updatePlan(methodModal.id, { method: methodChoice });
      if (activeCluster) await loadClusterData(activeCluster.id);
      showToastMsg(`Method → ${methodLabel(methodChoice)}`);
      setMethodModal(null);
    } catch (err) {
      alert(err.message || 'Could not change method');
    }
  };

  const openRunNow = (plan) => {
    const qs = {};
    (plan.queries || []).forEach((q, i) => { qs[i] = true; });
    if (plan.kind === 'ingest' && !plan.queries?.length) qs[0] = true;
    setRunQueries(qs);
    setRunModal({ plan });
  };

  const openSchedule = (plan) => {
    const sched = plan.schedule || {};
    setSchedForm({
      enabled: !!sched.enabled,
      frequency: sched.frequency || 'daily',
      time: sched.time || plusOneMinute(),
      dayOfWeek: sched.dayOfWeek ?? 1,
      dayOfMonth: sched.dayOfMonth ?? 1,
    });
    setScheduleModal(plan);
  };

  const saveSchedule = async () => {
    if (!scheduleModal) return;
    await api.updatePlan(scheduleModal.id, {
      schedule: { ...schedForm, resetFire: true },
    });
    if (activeCluster) await loadClusterData(activeCluster.id);
    setScheduleModal(null);
  };

  const executeRun = async () => {
    if (!runModal) return;
    setRunning(true);
    const plan = runModal.plan;
    let queries;
    if (plan.kind === 'probe' && plan.queries?.length) {
      queries = plan.queries.filter((_, i) => runQueries[i]);
    } else if (plan.kind === 'ingest' && !plan.queries?.length) {
      queries = [''];
    } else {
      queries = plan.queries;
    }
    try {
      await api.runPlan(plan.id, queries);
      if (activeCluster) await loadClusterData(activeCluster.id);
      setRunModal(null);
      showToastMsg(`Ran ${plan.name}`);
    } catch (err) {
      alert(err.message || 'Run failed — is Clone B API running on :4000?');
    } finally {
      setRunning(false);
    }
  };

  const executeBulkRun = async () => {
    setRunning(true);
    try {
      await api.runPlansBulk([...selectedPlans]);
      if (activeCluster) await loadClusterData(activeCluster.id);
      setConfigModal(false);
      showToastMsg('Bulk run finished');
    } finally {
      setRunning(false);
    }
  };

  const applyBulkConfig = async () => {
    await api.bulkConfigPlan([...selectedPlans], bulkMethod, 'keep');
    if (activeCluster) await loadClusterData(activeCluster.id);
    setConfigModal(false);
    if (bulkMethod !== 'keep') showToastMsg('Method applied to selected plans');
  };

  const handlePrefetch = async () => {
    if (!activeCluster || running) return;
    setRunning(true);
    try {
      await api.prefetchCluster(activeCluster.id, skipScript);
      await loadClusterData(activeCluster.id);
      showToastMsg('Prefetch complete');
    } catch (err) {
      alert(err.message || 'Prefetch failed — start Clone B on :4000');
    } finally {
      setRunning(false);
    }
  };

  const addQueryChip = async (planId) => {
    const q = prompt('Add probe query:');
    if (!q?.trim()) return;
    await api.addQuery(planId, q.trim());
    if (activeCluster) await loadClusterData(activeCluster.id);
  };

  const refreshSection = async (planId) => {
    setRunning(true);
    try {
      await api.runPlan(planId);
      if (activeCluster) await loadClusterData(activeCluster.id);
      showToastMsg('Section refreshed');
    } catch (err) {
      alert(err.message || 'Refresh failed');
    } finally {
      setRunning(false);
    }
  };

  const handleRollback = async (plan) => {
    if (!plan.canRollback) return;
    if (!confirm(`Restore previous snapshot for ${plan.name}?`)) return;
    try {
      const out = await api.rollbackPlan(plan.id);
      if (activeCluster) await loadClusterData(activeCluster.id);
      showToastMsg(`Rolled back ${out.restored} files`);
    } catch (err) {
      alert(err.message || 'No snapshot');
    }
  };

  const handleCreateCluster = async (e) => {
    e.preventDefault();
    if (!newClusterName.trim()) return;
    try {
      await api.createCluster(newClusterName.trim(), newClusterDesc.trim());
      await loadClusters();
      setCreateClusterOpen(false);
      setNewClusterName('');
      setNewClusterDesc('');
      showToastMsg(`Created cluster "${newClusterName.trim()}"`);
    } catch (err) {
      alert(err.message || 'Create failed');
    }
  };

  const openRenameCluster = (c, e) => {
    e?.stopPropagation();
    setRenameClusterTarget(c);
    setRenameClusterName(c.name);
    setRenameClusterDesc(c.description || '');
  };

  const handleRenameCluster = async (e) => {
    e.preventDefault();
    if (!renameClusterTarget || !renameClusterName.trim()) return;
    try {
      await api.renameCluster(renameClusterTarget.id, {
        name: renameClusterName.trim(),
        description: renameClusterDesc.trim(),
      });
      await loadClusters();
      if (activeCluster?.id === renameClusterTarget.id) {
        setActiveCluster({ ...activeCluster, name: renameClusterName.trim(), description: renameClusterDesc.trim() });
      }
      setRenameClusterTarget(null);
      showToastMsg('Cluster renamed');
    } catch (err) {
      alert(err.message || 'Rename failed');
    }
  };

  const handleDeleteCluster = async (c, e) => {
    e?.stopPropagation();
    if (!confirm(`Delete cluster "${c.name}" and all its warehouse data?`)) return;
    try {
      await api.deleteCluster(c.id);
      await loadClusters();
      showToastMsg(`Deleted ${c.name}`);
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleClearClusterData = async () => {
    const msg = `Clear ALL data inside "${activeCluster.name}" (warehouse + transform index)?`;
    if (!confirm(msg)) return;
    try {
      const out = await api.clearClusterData(activeCluster.id);
      await loadClusterData(activeCluster.id);
      await loadClusters();
      showToastMsg(`Cleared ${out.warehouseRemoved} warehouse file(s)`);
    } catch (err) {
      alert(err.message || 'Clear failed');
    }
  };

  const handleNav = (section) => {
    setActiveCluster(null);
    setPanel('data');
    setAppSection(section === 'clusters' ? null : section);
  };

  if (appSection === 'autofetch') {
    return <AutomationConsole onNav={handleNav} />;
  }

  if (appSection === 'transform') {
    return (
      <TransformConsole clusters={clusters} onNav={handleNav} />
    );
  }

  if (appSection === 'rules') {
    return <RulesConsole onNav={handleNav} />;
  }

  if (appSection === 'agent') {
    return (
      <AgentConsole clusters={clusters} onNav={handleNav} />
    );
  }

  if (!import.meta.env.VITE_API_URL) {
    return (
      <div className="app" style={{ padding: 24, maxWidth: 560 }}>
        <h1>BIS MITRA Admin</h1>
        <p className="warn">
          <strong>VITE_API_URL</strong> is missing. In Vercel → Project → Settings → Environment Variables, set:
        </p>
        <pre style={{ background: '#1a1a1a', padding: 12, borderRadius: 8 }}>
          VITE_API_URL=https://bis-mitra-admin-api.onrender.com
        </pre>
        <p className="row-sub">Redeploy after saving. Without this, the UI calls this Vercel site for /api and crashes.</p>
      </div>
    );
  }

  if (!activeCluster) {
    return (
      <div className="app">
        <AppNav
          active="clusters"
          onClusters={() => handleNav('clusters')}
          onAutofetch={() => handleNav('autofetch')}
          onTransform={() => handleNav('transform')}
          onRules={() => handleNav('rules')}
          onAgent={() => handleNav('agent')}
          onUserPortal={openUserPortal}
        />
        <HealthStrip status={svcStatus} />
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateClusterOpen(true)}>
            New cluster
          </button>
        </div>
        <div className="clusters">
          {clusters.length === 0 && (
            <p className="row-sub">No clusters yet. Create one, then set it as the Autofetch target.</p>
          )}
          {clusters.map(c => (
            <div key={c.id} className="cluster-card" onClick={() => openCluster(c)}>
              {c.published && <span className="badge badge-star">★ Published to agent</span>}
              <h3>{c.name}</h3>
              <p>{c.fileCount || 0} files</p>
              <div className="cluster-card-actions" onClick={e => e.stopPropagation()}>
                <button type="button" className="btn btn-sm" onClick={(e) => openRenameCluster(c, e)}>Rename</button>
                <button type="button" className="btn btn-sm danger" onClick={(e) => handleDeleteCluster(c, e)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <Modal
          open={createClusterOpen}
          title="Create new cluster"
          onClose={() => setCreateClusterOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-primary" onClick={handleCreateCluster}>Create</button>
              <button type="button" className="btn" onClick={() => setCreateClusterOpen(false)}>Cancel</button>
            </>
          }
        >
          <form onSubmit={handleCreateCluster}>
            <label>Name</label>
            <input value={newClusterName} onChange={e => setNewClusterName(e.target.value)} placeholder="Evaluator lab 1" autoFocus />
            <label>Description (optional)</label>
            <input value={newClusterDesc} onChange={e => setNewClusterDesc(e.target.value)} placeholder="Empty warehouse with ingest plans" />
          </form>
        </Modal>

        <Modal
          open={!!renameClusterTarget}
          title={renameClusterTarget ? `Rename · ${renameClusterTarget.name}` : ''}
          onClose={() => setRenameClusterTarget(null)}
          actions={
            <>
              <button type="button" className="btn btn-primary" onClick={handleRenameCluster}>Save</button>
              <button type="button" className="btn" onClick={() => setRenameClusterTarget(null)}>Cancel</button>
            </>
          }
        >
          <form onSubmit={handleRenameCluster}>
            <label>Name</label>
            <input value={renameClusterName} onChange={e => setRenameClusterName(e.target.value)} />
            <label>Description</label>
            <input value={renameClusterDesc} onChange={e => setRenameClusterDesc(e.target.value)} />
          </form>
        </Modal>
      </div>
    );
  }

  const methodOptions = methodModal ? methodOptionsForPlan(methodModal) : [];

  return (
    <div className="app">
      <AppNav
        active="clusters"
        onClusters={() => { setActiveCluster(null); setPanel('data'); }}
        onAutofetch={() => handleNav('autofetch')}
        onTransform={() => handleNav('transform')}
        onRules={() => handleNav('rules')}
        onAgent={() => handleNav('agent')}
        onUserPortal={openUserPortal}
      />
      <div className="cluster-header">
        <div>
          <button className="btn back" onClick={() => { setActiveCluster(null); setPanel('data'); }}>← Clusters</button>
          <h2 style={{ marginTop: 8 }}>{activeCluster.name}</h2>
          {activeCluster.published && <span className="badge badge-star">Published</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeCluster.published ? (
            <button className="btn" onClick={() => handlePublish(false)}>Unpublish</button>
          ) : (
            <button className="btn btn-primary" onClick={() => handlePublish(true)}>Publish</button>
          )}
        </div>
      </div>
      <div className="layout">
        <nav className="sidebar">
          <button className={panel === 'data' ? 'active' : ''} onClick={() => setPanel('data')}>Cluster data</button>
          <button className={panel === 'config' ? 'active' : ''} onClick={() => setPanel('config')}>Config fetch</button>
          <button className={panel === 'history' ? 'active' : ''} onClick={() => setPanel('history')}>Fetch history</button>
        </nav>
        <div className="main">
          <HealthStrip status={svcStatus} />
          <TrustStrip trust={trust} />
          {panel === 'data' && (
            <>
              <div className="toolbar">
                <input
                  className="wh-filter"
                  placeholder="Filter files…"
                  value={whFilter}
                  onChange={e => setWhFilter(e.target.value)}
                />
                <button type="button" className="btn btn-sm danger" onClick={handleClearClusterData}>
                  Clear all cluster data
                </button>
              </div>
              <SectionWarehouse
                clusterId={activeCluster.id}
                warehouse={warehouse}
                freshness={freshness}
                filter={whFilter}
                onPreview={openWarehousePreview}
                onLineage={openLineage}
                onUpload={openUpload}
                onJumpToPlan={jumpToPlan}
                onDelete={handleDeleteItem}
                onRefreshSection={refreshSection}
              />
            </>
          )}

          {panel === 'config' && (
            <>
              <div className="toolbar">
                <button className="btn btn-primary" disabled={running} onClick={handlePrefetch}>
                  Prefetch all ingest
                </button>
                <label className="checkbox-row" style={{ margin: 0 }}>
                  <input type="checkbox" checked={skipScript} onChange={e => setSkipScript(e.target.checked)} />
                  Skip Playwright (API/DB only)
                </label>
                <button className="btn" disabled={selectedPlans.size === 0} onClick={() => setConfigModal(true)}>
                  Config selected ({selectedPlans.size})
                </button>
                {KIND_FILTERS.map(f => (
                  <span key={f} className={`filter-pill ${kindFilter === f ? 'active' : ''}`} onClick={() => setKindFilter(f)}>{f}</span>
                ))}
                {running && <span className="running">Running…</span>}
              </div>
              <table>
                <thead>
                  <tr>
                    <th></th><th>Plan</th><th>Section</th><th>Kind</th><th>Method</th><th>Query</th>
                    <th>Schedule</th><th>Status</th><th>Result</th><th>Run</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map(p => (
                    <tr key={p.id} style={highlightPlanId === p.id ? { background: '#37373d' } : undefined}>
                      <td><input type="checkbox" checked={selectedPlans.has(p.id)} onChange={() => togglePlan(p.id)} /></td>
                      <td>
                        <PlanHover plan={p}>
                          <span className="plan-name">{p.name}</span>
                        </PlanHover>
                      </td>
                      <td>{sectionForPlan(p)}</td>
                      <td><span className={`badge badge-${p.kind}`}>{p.kind}</span></td>
                      <td>
                        <button className="btn btn-sm method-btn" onClick={() => openMethod(p)} title="DB/API or Playwright">
                          {methodLabel(p.method)}
                          {p.method === 'playwright' && p.playwrightPattern ? ` · ${p.playwrightPattern}` : ''}
                        </button>
                      </td>
                      <td>
                        <div className="chips">
                          {(p.queries?.length ? p.queries : ['—']).map((q, i) => (
                            <span key={i} className="chip">{q}</span>
                          ))}
                          {p.kind === 'probe' && (
                            <button className="chip-add" onClick={() => addQueryChip(p.id)}>+</button>
                          )}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => openSchedule(p)}>
                          {formatSchedule(p.schedule)}
                        </button>
                      </td>
                      <td>
                        <span className={`badge badge-${p.lastStatus === 'success' ? 'ok' : p.lastStatus === 'failed' ? 'fail' : 'probe'}`}>
                          {p.lastStatus || '—'}
                        </span>
                      </td>
                      <td><button className="btn btn-sm" onClick={() => openResult(p)}>Result</button></td>
                      <td><button className="btn btn-sm" disabled={running} onClick={() => openRunNow(p)}>Now</button></td>
                      <td>
                        <button className="btn btn-sm" disabled={!p.canRollback} onClick={() => handleRollback(p)}>
                          Rollback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {panel === 'history' && (
            <>
              {history.length === 0 && <p style={{ color: '#858585' }}>No runs yet.</p>}
              <table>
                <thead>
                  <tr><th>Status</th><th>Plan</th><th>Section</th><th>Kind</th><th>When</th><th>Stored?</th><th></th></tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td><span className={`badge badge-${h.status === 'success' ? 'ok' : 'fail'}`}>{h.status}</span></td>
                      <td>{h.planName}</td>
                      <td>{h.section || '—'}</td>
                      <td>{h.kind}</td>
                      <td>{formatDate(h.fetchedAt)}</td>
                      <td style={{ color: h.storedInWarehouse ? '#4ec9b0' : '#4fc1ff' }}>
                        {h.storedInWarehouse ? 'Yes → section' : 'No (probe)'}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => openHistoryEntry(h)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <Modal
        open={!!modal}
        wide={modal?.type === 'warehouse' && (isPdfItem(modal?.item) || isImageItem(modal?.item))}
        title={
          modal?.type === 'lineage' ? 'Data lineage'
            : modal?.type === 'warehouse' ? `${modal?.item?.type || 'File'} · ${modal?.item?.name}`
              : `Result · ${modal?.plan?.name}`
        }
        onClose={() => setModal(null)}
      >
        {modal?.type === 'lineage' && (
          <>
            <p className="row-sub" style={{ marginBottom: 12 }}>
              {modal.item.name} · {modal.item.domain}
            </p>
            {lineage ? <LineagePanel lineage={lineage} /> : <p className="running">Loading trace…</p>}
          </>
        )}
        {modal?.type === 'warehouse' && (
          <>
            <p style={{ fontSize: 12, color: '#858585', marginBottom: 8 }}>
              {modal.item.domain} · {modal.item.type} · {modal.item.source || 'fetch'} · {formatDate(modal.item.updatedAt)}
            </p>
            <WarehousePreviewBody item={modal.item} />
          </>
        )}
        {modal?.type === 'result' && modal.plan && (
          <>
            <p>Last run: <strong>{formatDate(modal.plan.lastRunAt)}</strong> · {modal.plan.lastStatus || '—'}</p>
            <p>Kind: <span className={`badge badge-${modal.plan.kind}`}>{modal.plan.kind}</span> · {methodLabel(modal.plan.method)}
              {modal.plan.playwrightPattern ? ` · Pattern ${modal.plan.playwrightPattern}` : ''}
            </p>
            {modal.plan.kind === 'probe' && <p className="warn">Not stored in Cluster data.</p>}
            {modal.plan.kind === 'ingest' && <p className="ok-text">Ingest replaces previous snapshot for this source.</p>}
            <div className="preview-box preview-box-tall">{JSON.stringify(modal.plan.lastResult || modal.history?.[0]?.payload, null, 2)}</div>
            {modal.history?.length > 0 && (
              <ul className="history-list">
                {modal.history.slice(0, 5).map((h, i) => (
                  <li key={h.id}>{i === 0 ? '●' : '○'} {formatDate(h.fetchedAt)} — {h.status}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={!!methodModal}
        title={methodModal ? `Method · ${methodModal.name}` : ''}
        onClose={() => setMethodModal(null)}
        actions={
          <>
            <button className="btn btn-primary" onClick={saveMethod} disabled={!methodChoice}>Save method</button>
            <button className="btn" onClick={() => setMethodModal(null)}>Cancel</button>
          </>
        }
      >
        {methodModal && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {methodModal.brief}
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
              <strong>What:</strong> {methodModal.what}<br />
              <strong>How ({methodLabel(methodChoice)}):</strong> {methodModal.howByMethod?.[methodChoice] || methodModal.how}<br />
              <strong>From:</strong> {methodModal.fromByMethod?.[methodChoice] || methodModal.from}
            </p>
            <label>Fetch method</label>
            <select value={methodChoice} onChange={e => setMethodChoice(e.target.value)}>
              {methodOptions.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="ok-text" style={{ marginTop: 8 }}>
              {FETCH_METHODS.find(m => m.id === methodChoice)?.description}
              {methodChoice === 'script' && methodModal.playwrightPattern ? ` Pattern ${methodModal.playwrightPattern}.` : ''}
            </p>
          </>
        )}
      </Modal>

      <Modal
        open={!!runModal}
        title={runModal ? `Run now · ${runModal.plan.name}` : ''}
        onClose={() => setRunModal(null)}
        actions={
          <>
            <button className="btn btn-primary" disabled={running} onClick={executeRun}>Run</button>
            <button className="btn" onClick={() => setRunModal(null)}>Cancel</button>
          </>
        }
      >
        {runModal && (
          <>
            <label>Method</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={`${methodLabel(runModal.plan.method)}${runModal.plan.playwrightPattern && (runModal.plan.method === 'script' || runModal.plan.method === 'playwright') ? ` · ${runModal.plan.playwrightPattern}` : ''}`}
                readOnly
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-sm" onClick={() => { setRunModal(null); openMethod(runModal.plan); }}>
                Change
              </button>
            </div>
            {(runModal.plan.method === 'script' || runModal.plan.method === 'playwright') && (
              <p className="warn">Playwright needs Clone portals running (:3001–:3003). Slower than API/DB.</p>
            )}
            {runModal.plan.method === 'db' && (
              <p className="ok-text">Reads bis-clone.db directly — Clone API does not need to be up, but the DB file does.</p>
            )}
            {runModal.plan.kind === 'probe' && runModal.plan.queries?.length > 0 && (
              <>
                <label>Queries to run</label>
                {runModal.plan.queries.map((q, i) => (
                  <div key={i} className="checkbox-row">
                    <input type="checkbox" checked={!!runQueries[i]} onChange={e => setRunQueries(prev => ({ ...prev, [i]: e.target.checked }))} />
                    {q}
                  </div>
                ))}
                <p className="warn">Result only — not written to Cluster data.</p>
              </>
            )}
            {runModal.plan.kind === 'ingest' && (
              <p className="ok-text">
                Fetches live Clone B data and replaces fetched files in the <strong>{sectionForPlan(runModal.plan)}</strong> section.
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={!!scheduleModal}
        title={scheduleModal ? `Schedule · ${scheduleModal.name}` : ''}
        onClose={() => setScheduleModal(null)}
        actions={
          <>
            <button className="btn btn-primary" onClick={saveSchedule}>Save schedule</button>
            <button className="btn" onClick={() => setScheduleModal(null)}>Cancel</button>
          </>
        }
      >
        {scheduleModal && (
          <>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={schedForm.enabled}
                onChange={e => setSchedForm(f => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </div>
            <label>Frequency</label>
            <select
              value={schedForm.frequency}
              onChange={e => setSchedForm(f => ({ ...f, frequency: e.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {schedForm.frequency === 'weekly' && (
              <>
                <label>Day</label>
                <select
                  value={schedForm.dayOfWeek}
                  onChange={e => setSchedForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </>
            )}
            {schedForm.frequency === 'monthly' && (
              <>
                <label>Date (day of month)</label>
                <select
                  value={schedForm.dayOfMonth}
                  onChange={e => setSchedForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </>
            )}
            <label>Time</label>
            <input
              type="time"
              value={schedForm.time}
              onChange={e => setSchedForm(f => ({ ...f, time: e.target.value }))}
            />
            <div className="modal-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setSchedForm(f => ({
                  ...f,
                  enabled: true,
                  frequency: 'daily',
                  time: plusOneMinute(),
                }))}
              >
                Demo: now + 1 min
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={uploadModal}
        title={`Upload into ${uploadDomain} section`}
        onClose={() => setUploadModal(false)}
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </button>
            <button type="button" className="btn" onClick={() => setUploadModal(false)}>Cancel</button>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          File is stored in the <strong>{uploadDomain}</strong> section for agent retrieval.
          Re-uploading the same name replaces that file. PDFs open in the warehouse preview.
        </p>
        <label>Section</label>
        <select value={uploadDomain} onChange={e => setUploadDomain(e.target.value)}>
          {SECTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <label>Note (optional)</label>
        <input value={uploadNote} onChange={e => setUploadNote(e.target.value)} placeholder="Stored in this section for agent retrieval" />
        <input ref={fileInputRef} type="file" accept=".pdf,.json,.txt,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleUploadFile} />
      </Modal>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>

      <Modal
        open={configModal}
        title={`Config selected (${selectedPlans.size})`}
        onClose={() => setConfigModal(false)}
        actions={
          <>
            <button className="btn btn-primary" disabled={running || selectedPlans.size === 0} onClick={executeBulkRun}>Run now selected</button>
            <button className="btn" onClick={applyBulkConfig}>Apply method</button>
            <button className="btn" onClick={() => setConfigModal(false)}>Close</button>
          </>
        }
      >
        <label>Change method (all three available on every plan)</label>
        <select value={bulkMethod} onChange={e => setBulkMethod(e.target.value)}>
          <option value="keep">Keep current</option>
          {FETCH_METHODS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <p className="warn">
          Applies Clone API, Direct DB, or Playwright script to every selected plan.
        </p>
      </Modal>
    </div>
  );
}
