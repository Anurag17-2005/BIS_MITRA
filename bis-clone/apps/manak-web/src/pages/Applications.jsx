import { useEffect, useState } from 'react';
import { fetchApplications, patchApplicationStatus } from '../api';

const STATUSES = [
  'Under Review',
  'Query Raised',
  'Documents Required',
  'Inspection Scheduled',
  'Granted',
  'Rejected',
];

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

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
              {['Reference', 'Product', 'IS', 'Status', 'Submitted'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.reference_id || row.id}>
                <td style={{ padding: 8 }}>{row.reference_id}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
