import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { runDemoAction, createNews } from '../api';

const ACTIONS = [
  { id: 'toy-safety-ban', tab: 'citizen', label: '🚨 Immediate Toxic Toy Ban (IS 9873)', desc: 'Notifies Citizens & Enforcement (Lead > 90 mg/kg recall)', severity: 'critical' },
  { id: 'grievance-officer-assigned', tab: 'citizen', label: '⚡ Dispatch Officer for Extension Board (CON-GRP-4401)', desc: 'Notifies Citizen: ticket assigned for surprise sample collection', severity: 'critical' },
  { id: 'counterfeit-helmet-seizure', tab: 'citizen', label: '🛑 Counterfeit Seizure Alert (FakeArmor CM/L-4151999)', desc: 'Notifies Citizens & Enforcement: 450 fake helmets seized', severity: 'critical' },
  { id: 'hazard-bottle-alert', tab: 'citizen', label: '🍼 Hazard Flag Escalation: Baby Bottles (HAZ-8802)', desc: 'Notifies Enforcement & Citizens: emergency inspection ordered', severity: 'critical' },
  { id: 'publish-amendment', tab: 'amendment', label: 'Publish IS 4151 Amendment 1', desc: 'Notifies Industry, Enforcement, Labs', severity: 'critical' },
  { id: 'hallmarking-expansion', tab: 'hallmarking', label: 'Hallmarking district expansion', desc: 'Notifies Gold buyers & Citizens', severity: 'warning' },
  { id: 'consumer-recall', tab: 'consumer', label: 'Consumer product recall', desc: 'Notifies Citizens, Enforcement, Industry', severity: 'critical' },
  { id: 'crs-deadline', tab: 'crs', label: 'CRS import deadline (LED)', desc: 'Notifies Foreign exporters & Enforcement', severity: 'critical' },
  { id: 'lab-recognition', tab: 'labs', label: 'Update lab recognition list', desc: 'Notifies Labs & Industry (Pune queue)', severity: 'warning' },
  { id: 'qco-steel', tab: 'qco', label: 'QCO border enforcement (steel)', desc: 'Notifies Exporters, Enforcement, Industry', severity: 'critical' },
];

export default function DemoConsole() {
  const [params] = useSearchParams();
  const activeTab = params.get('tab') || 'all';
  const [busy, setBusy] = useState(null);
  const [last, setLast] = useState(null);
  const [customNews, setCustomNews] = useState({ title: '', summary: '', category: 'General' });

  const run = async (actionId) => {
    setBusy(actionId);
    try {
      const out = await runDemoAction(actionId);
      setLast({ actionId, at: new Date().toLocaleTimeString(), ...out });
    } catch (e) {
      setLast({ actionId, error: e.message });
    } finally {
      setBusy(null);
    }
  };

  const publishCustom = async (e) => {
    e.preventDefault();
    setBusy('custom-news');
    try {
      const out = await createNews({ ...customNews, published_at: new Date().toISOString().slice(0, 10) });
      setLast({ actionId: 'custom-news', at: new Date().toLocaleTimeString(), ...out });
      setCustomNews({ title: '', summary: '', category: 'General' });
    } catch (err) {
      setLast({ error: err.message });
    } finally {
      setBusy(null);
    }
  };

  const filtered = activeTab === 'all'
    ? ACTIONS
    : ACTIONS.filter(a => a.tab === activeTab);

  return (
    <div>
      <div className="bis-breadcrumb">
        <Link to="/">Home</Link> / <span className="active">Ministry Demo Console</span>
      </div>
      <h1 className="bis-page-title">BIS Portal — Live Change Console</h1>
      <p style={{ maxWidth: 720, color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
        Make a change here on the BIS website. MITRA detects it via fingerprint polling and pushes
        a <strong>persona-matched alert</strong> only to relevant users on their dashboard.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', 'citizen', 'amendment', 'hallmarking', 'consumer', 'crs', 'labs', 'qco'].map(t => (
          <Link
            key={t}
            to={t === 'all' ? '/demo-console' : `/demo-console?tab=${t}`}
            className="bis-btn"
            style={{
              background: activeTab === t ? '#003366' : '#eee',
              color: activeTab === t ? '#fff' : '#003366',
              fontSize: 12,
            }}
          >
            {t}
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        {filtered.map(a => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid #ddd', borderLeft: `4px solid ${a.severity === 'critical' ? '#c0392b' : '#e67e22'}`, padding: 16 }}>
            <h3 style={{ fontSize: 14, color: '#003366', marginBottom: 6 }}>{a.label}</h3>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>{a.desc}</p>
            <button
              type="button"
              className="bis-btn"
              disabled={busy === a.id}
              onClick={() => run(a.id)}
              data-testid={`demo-action-${a.id}`}
            >
              {busy === a.id ? 'Publishing…' : 'Publish change'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: '#f7f9fc', border: '1px solid #c5d0e0', padding: 20, maxWidth: 640, marginBottom: 24 }}>
        <h3 style={{ color: '#003366', marginBottom: 12 }}>Custom news announcement</h3>
        <form onSubmit={publishCustom}>
          <input style={{ width: '100%', padding: 8, marginBottom: 8, border: '1px solid #ccc' }} placeholder="Title" value={customNews.title} onChange={e => setCustomNews(n => ({ ...n, title: e.target.value }))} required />
          <textarea style={{ width: '100%', padding: 8, marginBottom: 8, border: '1px solid #ccc', minHeight: 60 }} placeholder="Summary" value={customNews.summary} onChange={e => setCustomNews(n => ({ ...n, summary: e.target.value }))} />
          <select style={{ padding: 8, marginBottom: 12, border: '1px solid #ccc' }} value={customNews.category} onChange={e => setCustomNews(n => ({ ...n, category: e.target.value }))}>
            <option>General</option>
            <option>Certification</option>
            <option>Standards</option>
            <option>Hallmarking</option>
            <option>QCO</option>
            <option>Consumer</option>
            <option>Recall</option>
            <option>CRS</option>
            <option>Labs</option>
          </select>
          <button type="submit" className="bis-btn" disabled={busy === 'custom-news'}>Publish & notify</button>
        </form>
      </div>

      {last && (
        <div style={{ background: '#d4edda', border: '1px solid #28a745', padding: 16, maxWidth: 720 }}>
          <strong>Last change applied {last.at || ''}</strong>
          <pre style={{ fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(last, null, 2)}</pre>
          <p style={{ fontSize: 12, marginTop: 8, color: '#155724' }}>
            → Switch to MITRA Agent, select the matching user persona, and watch the alert appear within 30 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
