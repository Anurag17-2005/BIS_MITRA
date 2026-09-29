import { useEffect, useState } from 'react';
import { fetchApplications, patchApplicationStatus } from '../api';

const STATUSES = [
  'Submitted',
  'Under Review',
  'Query Raised',
  'Documents Required',
  'Inspection Scheduled',
  'Testing',
  'Granted',
  'Certified',
  'Rejected',
];

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [expanded, setExpanded] = useState('');

  const load = () => {
    fetchApplications()
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load applications.'));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const onStatus = async (row, status) => {
    if (status === row.status) return;
    setSaving(row.reference_id);
    setError('');
    try {
      const updated = await patchApplicationStatus(row.reference_id, status, row.scheme);
      setRows((list) => list.map((item) => (
        item.reference_id === row.reference_id ? { ...item, ...updated, scheme: row.scheme } : item
      )));
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="manak-page-card">
      <h1 className="page-title">Applications</h1>
      <p style={{ color: '#555', marginBottom: 12 }}>
        Change status to notify the applicant in MITRA My Alerts (and WhatsApp).
      </p>
      {error && <p>{error}</p>}
      {!error && rows.length === 0 && <p>No applications yet.</p>}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Application ID', 'Manufacturer', 'Product', 'Standard', 'Status', 'Submitted On', 'Action'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = row.reference_id || row.id;
              const history = Array.isArray(row.status_history) ? row.status_history : [];
              return [
                <tr key={id}>
                  <td style={{ padding: 8 }}>{id}</td>
                  <td style={{ padding: 8 }}>{row.company_name || row.factory_name || '—'}</td>
                  <td style={{ padding: 8 }}>{row.product_name}</td>
                  <td style={{ padding: 8 }}>{row.is_number}</td>
                  <td style={{ padding: 8 }}>
                    <select
                      value={row.status || 'Under Review'}
                      disabled={saving === row.reference_id}
                      onChange={(e) => onStatus(row, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8 }}>{row.submitted_at}</td>
                  <td style={{ padding: 8 }}>
                    <button type="button" onClick={() => setExpanded(expanded === id ? '' : id)}>
                      {expanded === id ? 'Hide history' : 'View history'}
                    </button>
                  </td>
                </tr>,
                expanded === id && (
                  <tr key={`${id}-history`}>
                    <td colSpan={7} style={{ padding: '8px 16px', background: '#f7f8fa' }}>
                      <strong>Status history</strong>
                      {history.length === 0 ? (
                        <p>No history recorded.</p>
                      ) : (
                        <ol>
                          {history.map((event, index) => (
                            <li key={`${event.changed_at || event.at}-${index}`}>
                              <strong>{event.new_status || event.status}</strong>
                              {' — '}{event.changed_by || 'System'}
                              {' · '}{event.changed_at || event.at}
                              {event.note ? ` · ${event.note}` : ''}
                            </li>
                          ))}
                        </ol>
                      )}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
