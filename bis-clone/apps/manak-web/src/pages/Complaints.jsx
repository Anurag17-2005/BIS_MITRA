import { useEffect, useState } from 'react';
import { fetchGrievances, patchGrievanceStatus } from '../api';

const STATUSES = ['SUBMITTED', 'Investigation', 'Resolved', 'Rejected'];

export default function Complaints() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  const load = () => {
    fetchGrievances()
      .then((data) => setRows(Array.isArray(data) ? data.filter((r) => /^CMP-DEMO-/i.test(r.ticket_id || '')) : []))
      .catch(() => setError('Could not load complaints.'));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const onStatus = async (row, status) => {
    if (status === row.status) return;
    setSaving(row.ticket_id);
    setError('');
    try {
      await patchGrievanceStatus(row.ticket_id, status);
      load();
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="manak-page-card">
      <h1 className="page-title">Consumer complaints</h1>
      <p style={{ color: '#555', marginBottom: 12 }}>
        Update CMP-DEMO-* status to notify the complainant in MITRA My Alerts.
      </p>
      {error && <p>{error}</p>}
      {!error && rows.length === 0 && <p>No CMP-DEMO complaints yet.</p>}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ticket ID', 'Product', 'Merchant', 'Status', 'Updated', 'Action'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticket_id}>
                <td style={{ padding: 8 }}>{row.ticket_id}</td>
                <td style={{ padding: 8 }}>{row.product_name || row.product_category}</td>
                <td style={{ padding: 8 }}>{row.merchant_name}</td>
                <td style={{ padding: 8 }}>{row.status}</td>
                <td style={{ padding: 8 }}>{row.updated_at || row.created_at}</td>
                <td style={{ padding: 8 }}>
                  <select
                    value={row.status || 'SUBMITTED'}
                    disabled={saving === row.ticket_id}
                    onChange={(e) => onStatus(row, e.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
