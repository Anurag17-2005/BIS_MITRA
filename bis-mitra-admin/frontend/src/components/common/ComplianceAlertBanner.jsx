import { useEffect, useState } from 'react';
import * as api from '../../api';
import { getPersona } from '../../config/userPersonas';

export default function ComplianceAlertBanner({ personaId = 'industry' }) {
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [userAlerts, setUserAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissed, setDismissed] = useState(new Set());
  const persona = getPersona(personaId);
  const sessionId = api.getSessionId();

  const load = () => {
    api.getComplianceAlerts(true, personaId).then(setComplianceAlerts).catch(() => setComplianceAlerts([]));
    api.getUserAlerts(sessionId, { unread: true, userId: personaId })
      .then((data) => {
        setUserAlerts(data.alerts || []);
        setUnreadCount(data.unread_count || 0);
      })
      .catch(() => {
        setUserAlerts([]);
        setUnreadCount(0);
      });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [personaId, sessionId]);

  const normalized = [
    ...userAlerts.map(a => ({
      id: a.alert_id || a.id,
      title: a.title,
      summary: a.message,
      severity: a.priority === 'critical' ? 'critical' : (a.priority === 'high' ? 'warning' : 'info'),
      source: a.source,
      is_number: a.related_record_id,
      kind: 'user',
      related_record_id: a.related_record_id,
      related_service_id: a.related_service_id,
    })),
    ...complianceAlerts.map(a => ({ ...a, kind: 'compliance' })),
  ];

  const visible = normalized.filter(a => !dismissed.has(a.id));
  if (!visible.length) {
    return (
      <section className="agent-section agent-alerts agent-alerts-clear">
        <span className="row-sub">No active alerts for {persona.short}</span>
      </section>
    );
  }

  const top = visible[0];

  const ack = async (item) => {
    try {
      if (item.kind === 'user') {
        await api.markUserAlertRead(item.id, sessionId);
      } else {
        await api.acknowledgeComplianceAlert(item.id);
      }
      setDismissed(d => new Set(d).add(item.id));
      load();
    } catch {
      setDismissed(d => new Set(d).add(item.id));
    }
  };

  return (
    <section className={`agent-section agent-alerts ${top.severity === 'critical' ? 'critical' : ''}`}>
      <div className="compliance-alert-pulse" />
      <div className="compliance-alert-body">
        <h2>{top.kind === 'user' ? 'Your update' : 'Compliance alert'}{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</h2>
        <strong>{top.title}</strong>
        <p>{top.summary}</p>
        <div className="agent-alert-meta">
          {top.related_record_id && <span className="chip chip-live">{top.related_record_id}</span>}
          {top.is_number && !top.related_record_id && <span className="chip chip-live">{top.is_number}</span>}
          <span className="chip">for {persona.short}</span>
          {top.source && <span className="chip">{top.source}</span>}
        </div>
      </div>
      <button type="button" className="btn btn-sm" onClick={() => ack(top)}>Acknowledge</button>
    </section>
  );
}
