import { useState, useEffect } from 'react';
import { fetchCertificationList } from '../api';

export default function StandardsList() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchCertificationList().then(setRows);
  }, []);

  const filtered = rows.filter(r =>
    !filter || r.standard_number.toLowerCase().includes(filter.toLowerCase()) ||
    r.standard_title.toLowerCase().includes(filter.toLowerCase())
  );

  const exportCsv = () => {
    const csv = ['S.NO.,Standard Number,Standard Title,Mandatory/Voluntary',
      ...filtered.map((r, i) => `${i + 1},${r.standard_number},"${r.standard_title}",${r.mandatory_voluntary}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'standards-under-certification.csv';
    a.click();
  };

  return (
    <div className="manak-page-card">
      <h1 className="page-title">Standards Under Certification (ALL INDIA)</h1>
      <button className="export-btn" onClick={exportCsv} data-testid="export-excel">Export To Excel</button>
      <div style={{ float: 'right', marginBottom: 12 }}>
        Search: <input type="text" value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: 6, border: '1px solid #ddd', borderRadius: 4 }} data-testid="cert-list-search" />
      </div>
      <table className="cert-table" data-testid="certification-table">
        <thead>
          <tr>
            <th>S.NO.</th>
            <th>Standard Number</th>
            <th>Standard Title</th>
            <th>Mandatory/Voluntary</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={r.standard_number} data-testid={`cert-row-${r.standard_number.replace(/[^a-zA-Z0-9]/g, '-')}`}>
              <td>{i + 1}</td>
              <td>{r.standard_number}</td>
              <td>{r.standard_title}</td>
              <td>{r.mandatory_voluntary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
