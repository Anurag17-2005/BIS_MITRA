import { useState } from 'react';
import { submitFormI } from '../api';

export default function ApplyFormI() {
  const [form, setForm] = useState({
    factory_name: '',
    udyam_id: '',
    lab_report_ref: '',
    is_number: 'IS 2082:2018',
    product_name: 'Electric Storage Water Heater',
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submitFormI(form);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-breadcrumb">
        <span>Conformity Assessment</span> / <span className="active">Form-I Application</span>
      </div>
      <h1 className="page-title">Form-I — Product Certification Application</h1>
      <p style={{ marginBottom: 16, color: '#555' }}>
        Submit factory details and independent lab test report for Scheme-I (ISI Mark) certification.
      </p>
      {result?.error ? (
        <div style={{ padding: 16, background: '#f8d7da', borderRadius: 4, marginBottom: 16 }}>
          <strong>Submission failed:</strong> {result.error}
        </div>
      ) : null}
      {result?.reference_id ? (
        <div style={{ padding: 16, background: '#d4edda', borderRadius: 4 }} data-testid="form-i-success">
          <strong>Application Submitted!</strong><br />
          Tracking ID: <span data-testid="form-i-tracking">{result.reference_id}</span>
          {result.lab_report_ref && (
            <div>Lab Report: {result.lab_report_ref}</div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
          <div className="form-group">
            <label>Factory / Company Name</label>
            <input
              id="factory_name"
              data-testid="factory_name"
              value={form.factory_name}
              onChange={e => setForm({ ...form, factory_name: e.target.value })}
              placeholder="Demo Geyser Works Pvt Ltd"
              required
            />
          </div>
          <div className="form-group">
            <label>Udyam MSME Registration ID</label>
            <input
              id="udyam_id"
              data-testid="udyam_id"
              value={form.udyam_id}
              onChange={e => setForm({ ...form, udyam_id: e.target.value })}
              placeholder="UDYAM-MH-12-0012345"
              required
            />
          </div>
          <div className="form-group">
            <label>IS Number</label>
            <select
              id="is_number"
              value={form.is_number}
              onChange={e => setForm({ ...form, is_number: e.target.value })}
            >
              <option value="IS 2082:2018">IS 2082:2018 — Electric Water Heater</option>
              <option value="IS 4151:2015">IS 4151:2015 — Two-wheeler Helmet</option>
              <option value="IS 623:2025">IS 623:2025 — Bicycle Frame</option>
            </select>
          </div>
          <div className="form-group">
            <label>Product Name</label>
            <input
              id="product_name"
              data-testid="product_name"
              value={form.product_name}
              onChange={e => setForm({ ...form, product_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Independent Lab Test Report Reference</label>
            <input
              id="lab_report_ref"
              data-testid="lab_report_ref"
              value={form.lab_report_ref}
              onChange={e => setForm({ ...form, lab_report_ref: e.target.value })}
              placeholder="NTH-9941"
              required
            />
          </div>
          <button
            type="submit"
            id="btn-submit"
            data-testid="btn-submit"
            className="login-btn"
            disabled={busy}
          >
            {busy ? 'Submitting…' : 'Submit Form-I'}
          </button>
        </form>
      )}
    </div>
  );
}
