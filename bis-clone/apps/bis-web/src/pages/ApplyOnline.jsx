import { useState } from 'react';
import { submitApplication } from '../api';

export default function ApplyOnline() {
  const [form, setForm] = useState({ company_name: '', is_number: '', product_name: '' });
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await submitApplication(form);
    setResult(res);
  };

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / Product Certification / <span className="active">Apply Online</span>
      </div>
      <h1 className="bis-page-title">Apply Online for Product Certification</h1>
      {result ? (
        <div style={{ padding: 16, background: '#d4edda', borderRadius: 4 }} data-testid="application-success">
          <strong>Application Submitted!</strong><br />
          Reference ID: <span data-testid="application-reference">{result.reference_id}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
          <div className="bis-form-group">
            <label>Company Name</label>
            <input data-testid="apply-company" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} required />
          </div>
          <div className="bis-form-group">
            <label>IS Number</label>
            <select data-testid="apply-is-number" value={form.is_number} onChange={e => setForm({ ...form, is_number: e.target.value })} required>
              <option value="">Select IS Number</option>
              <option value="IS 4151:2015">IS 4151:2015 - Helmet</option>
              <option value="IS 623:2025">IS 623:2025 - Bicycle Frame</option>
              <option value="IS 3055 (Part 1):1994">IS 3055 - Clinical Thermometer</option>
            </select>
          </div>
          <div className="bis-form-group">
            <label>Product Name</label>
            <input data-testid="apply-product" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} required />
          </div>
          <button type="submit" className="bis-btn" data-testid="apply-submit">Submit Application</button>
        </form>
      )}
    </div>
  );
}
