import { useEffect, useState } from 'react';
import * as api from '../../../api';

export default function MitraAlertsPage({ personaId, sessionId, onAskAbout }) {
  const [alerts, setAlerts] = useState([]);
  const [compliance, setCompliance] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ua, ca] = await Promise.all([
          api.getUserAlerts(sessionId, { unread: false, userId: personaId }),
          api.getComplianceAlerts(true, personaId),
        ]);
        setAlerts(ua.alerts || ua || []);
        setCompliance(ca.alerts || ca || []);
      } catch {
        setAlerts([]);
        setCompliance([]);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [personaId, sessionId]);

  const all = [...compliance, ...alerts];

  return (
    <div className="mitra-page">
      <h2>🔔 Alerts</h2>
      {all.length === 0 && <p className="mitra-empty-inline">No alerts right now.</p>}
      <ul className="mitra-alert-page-list">
        {all.map((a) => (
          <li key={a.id} className="mitra-alert-card">
            <div>
              <strong>{a.title || a.alert_type}</strong>
              <p className="mitra-panel-meta">{a.message || a.summary || a.body}</p>
            </div>
            <div className="mitra-alert-card-actions">
              <span className="mitra-badge">{a.priority || a.severity || 'info'}</span>
              <button type="button" className="btn btn-sm" onClick={() => onAskAbout(a.title || 'Tell me about this alert')}>
                Ask MITRA
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
