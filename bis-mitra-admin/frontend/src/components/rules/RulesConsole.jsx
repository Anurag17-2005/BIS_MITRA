import { useState, useEffect, useCallback } from 'react';
import { config } from '../../config.js';
import AppNav from '../common/AppNav';
import Drawer from '../common/Drawer';
import * as api from '../../api';

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'validation', label: 'Validation' },
  { id: 'calculation', label: 'Calculation' },
  { id: 'status', label: 'Status' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'comparison', label: 'Comparison' },
];

const TYPE_LABELS = {
  validation: 'Validation',
  calculation: 'Calculation',
  status: 'Status',
  eligibility: 'Eligibility',
  comparison: 'Comparison',
};

function emptyRule() {
  return {
    id: '',
    name: '',
    type: 'status',
    category: 'Certification',
    enabled: true,
    description: '',
    conditions: [{ field: '', operator: '==', value: '' }],
    result: '',
    executor: 'licence_status',
    testInputs: [{ key: 'query', label: 'Input', placeholder: '' }],
    source: 'Certification',
  };
}

export default function RulesConsole({ onNav, onSignOut }) {
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [activeRule, setActiveRule] = useState(null);
  const [form, setForm] = useState(emptyRule());
  const [testInputs, setTestInputs] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { rules: rows } = await api.getRules(tab, search);
      setRules(rows);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const openTest = (rule) => {
    setActiveRule(rule);
    const defaults = {};
    for (const inp of rule.testInputs || []) {
      defaults[inp.key] = inp.placeholder || '';
    }
    setTestInputs(defaults);
    setTestResult(null);
    setShowEvidence(false);
    setDrawer('test');
  };

  const openEdit = (rule) => {
    setActiveRule(rule);
    setForm({ ...rule, conditions: rule.conditions?.length ? [...rule.conditions] : [{ field: '', operator: '==', value: '' }] });
    setDrawer('edit');
    setMsg('');
  };

  const openNew = () => {
    const r = emptyRule();
    r.id = `RULE-${Date.now().toString(36).toUpperCase()}`;
    setActiveRule(null);
    setForm(r);
    setDrawer('edit');
    setMsg('');
  };

  const runTest = async () => {
    if (!activeRule) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      setTestResult(await api.testRule(activeRule.id, testInputs));
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTestBusy(false);
    }
  };

  const saveRule = async () => {
    setSaveBusy(true);
    setMsg('');
    try {
      if (activeRule?.id && drawer === 'edit' && activeRule.id === form.id) {
        await api.updateRule(form.id, form);
        setMsg('Saved');
      } else {
        await api.createRule(form);
        setMsg('Created');
      }
      await reload();
      setDrawer(null);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaveBusy(false);
    }
  };

  const toggleEnabled = async (rule) => {
    await api.updateRule(rule.id, { enabled: !rule.enabled });
    reload();
  };

  return (
    <div className="app rules-app">
      <AppNav
        active="rules"
        onClusters={() => onNav('clusters')}
        onAutofetch={() => onNav('autofetch')}
        onTransform={() => onNav('transform')}
        onAgent={() => onNav('agent')}
        onRules={() => {}}
        onUserPortal={() => window.open(config.userPortalUrl, '_blank', 'noopener')}
        onSignOut={onSignOut}
      />

      <header className="rules-header">
        <div>
          <h1>Rules / Intelligence</h1>
          <p className="row-sub">Manage and test deterministic BIS MITRA rules.</p>
        </div>
      </header>

      <div className="rules-tabs">
        {TYPE_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`filter-pill ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rules-toolbar">
        <input
          className="wh-filter"
          placeholder="Search rules…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>+ New Rule</button>
      </div>

      {loading && <p className="row-sub">Loading…</p>}

      <div className="rules-list">
        {rules.map(rule => (
          <article key={rule.id} className="rule-card">
            <div className="rule-card-main">
              <div className="rule-card-head">
                <strong>{rule.name}</strong>
                <button
                  type="button"
                  className={`rule-status ${rule.enabled ? 'on' : 'off'}`}
                  onClick={() => toggleEnabled(rule)}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  ● {rule.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <p className="rule-card-meta">
                {TYPE_LABELS[rule.type] || rule.type} • {rule.category}
              </p>
              <p className="rule-card-desc">{rule.description}</p>
            </div>
            <div className="rule-card-actions">
              <button type="button" className="btn btn-sm" onClick={() => openTest(rule)}>Test</button>
              <button type="button" className="btn btn-sm" onClick={() => openEdit(rule)}>Edit</button>
            </div>
          </article>
        ))}
        {!loading && rules.length === 0 && (
          <p className="row-sub">No rules match this filter.</p>
        )}
      </div>

      <Drawer
        open={drawer === 'test'}
        title={`Test: ${activeRule?.name || ''}`}
        onClose={() => setDrawer(null)}
      >
        {activeRule?.testInputs?.map(inp => (
          <label key={inp.key} className="drawer-field">
            {inp.label}
            <input
              className="wh-filter"
              value={testInputs[inp.key] ?? ''}
              onChange={e => setTestInputs(t => ({ ...t, [inp.key]: e.target.value }))}
              placeholder={inp.placeholder}
            />
          </label>
        ))}
        <button type="button" className="btn btn-primary" disabled={testBusy} onClick={runTest} style={{ marginTop: 12 }}>
          {testBusy ? 'Running…' : 'Run Test'}
        </button>

        {testResult && (
          <div className="rule-test-result">
            <h4>Result</h4>
            {testResult.ok === false ? (
              <p className="warn">{testResult.error}</p>
            ) : (
              <>
                <p className={`rule-outcome ${testResult.passed ? 'ok' : 'warn'}`}>
                  {testResult.passed ? '✓' : '○'} {testResult.display || testResult.outcome}
                </p>
                <p className="row-sub">Rule: {testResult.ruleId}</p>
                <p className="row-sub">Source: {testResult.source}</p>
                {testResult.evidence && (
                  <button type="button" className="btn btn-sm" onClick={() => setShowEvidence(v => !v)}>
                    {showEvidence ? 'Hide Evidence' : 'View Evidence'}
                  </button>
                )}
                {showEvidence && testResult.evidence && (
                  <pre className="trace-pre">{JSON.stringify(testResult.evidence, null, 2)}</pre>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>

      <Drawer
        open={drawer === 'edit'}
        title={activeRule ? `Edit: ${activeRule.name}` : 'New Rule'}
        onClose={() => setDrawer(null)}
        footer={(
          <>
            {msg && <span className="row-sub">{msg}</span>}
            <button type="button" className="btn btn-primary" disabled={saveBusy} onClick={saveRule}>
              {saveBusy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={() => setDrawer(null)}>Cancel</button>
          </>
        )}
      >
        <label className="drawer-field">Name
          <input className="wh-filter" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="drawer-field">Type
          <select className="wh-filter" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TYPE_TABS.filter(t => t.id !== 'all').map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="drawer-field">Category
          <input className="wh-filter" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </label>
        <label className="drawer-field">Description
          <input className="wh-filter" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </label>

        <div className="drawer-section">
          <h4>Conditions</h4>
          {(form.conditions || []).map((c, i) => (
            <div key={i} className="rule-cond-row">
              <input className="wh-filter" placeholder="field" value={c.field}
                onChange={e => setForm(f => {
                  const conditions = [...f.conditions];
                  conditions[i] = { ...conditions[i], field: e.target.value };
                  return { ...f, conditions };
                })} />
              <select className="wh-filter" value={c.operator}
                onChange={e => setForm(f => {
                  const conditions = [...f.conditions];
                  conditions[i] = { ...conditions[i], operator: e.target.value };
                  return { ...f, conditions };
                })}>
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
              </select>
              <input className="wh-filter" placeholder="value" value={c.value}
                onChange={e => setForm(f => {
                  const conditions = [...f.conditions];
                  conditions[i] = { ...conditions[i], value: e.target.value };
                  return { ...f, conditions };
                })} />
            </div>
          ))}
        </div>

        <label className="drawer-field">Result
          <input className="wh-filter" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} />
        </label>

        <details className="drawer-advanced">
          <summary>Advanced details</summary>
          <label className="drawer-field">Rule ID
            <input className="wh-filter" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!activeRule} />
          </label>
          <label className="drawer-field">Executor
            <select className="wh-filter" value={form.executor} onChange={e => setForm(f => ({ ...f, executor: e.target.value }))}>
              <option value="standard_validation">standard_validation</option>
              <option value="qco_applicability">qco_applicability</option>
              <option value="licence_status">licence_status</option>
              <option value="lab_status">lab_status</option>
              <option value="huid_validation">huid_validation</option>
              <option value="amendment_check">amendment_check</option>
            </select>
          </label>
          <label className="drawer-field">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
            {' '}Enabled
          </label>
        </details>
      </Drawer>
    </div>
  );
}
