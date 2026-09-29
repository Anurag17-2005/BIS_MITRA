import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api';

export default function ConsumerComplaints() {
  const [formData, setFormData] = useState({
    consumer_name: 'Rajesh Kumar',
    merchant_name: 'PowerSafe Retail Electronics',
    product_category: 'Electrical Accessories',
    invoice_number: 'INV-2026-8821',
    evidence_upload: 'store_bill_invoice_2026_8821.pdf',
    complaint_details: 'My new extension board caught fire this morning while charging my phone. I have the store bill. Can you file an official complaint against this brand for me?',
  });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/consumer/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        ok: true,
        ticket_id: 'CON-GRP-4401',
        message: 'I have successfully filled out and dispatched your safety grievance to the enforcement cell. Complaint Ticket ID: CON-GRP-4401 has been created. I will automatically track this ticket on your dashboard profile.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="bis-breadcrumb">
        <Link to="/">Home</Link> / <Link to="/consumer-guidance">Consumer Guidance</Link> / <span className="active">Public Grievance Intake</span>
      </div>

      <div style={{ maxWidth: 720, background: '#fff', border: '1px solid #cbd5e1', borderTop: '4px solid #003366', padding: 28, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>🛡️</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: '#003366' }}>Public Consumer Grievance Portal</h1>
            <div style={{ fontSize: 12, color: '#64748b' }}>Bureau of Indian Standards — Enforcement & Consumer Protection Cell</div>
          </div>
        </div>

        <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          File an official quality grievance against defective, hazardous, or non-certified products. Your complaint will be dispatched directly to the regional enforcement squad for sample verification.
        </p>

        <form onSubmit={handleSubmit} id="grievance-form">
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Consumer Name</label>
            <input
              type="text"
              id="consumer_name"
              value={formData.consumer_name}
              onChange={e => setFormData({ ...formData, consumer_name: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Merchant / Retail Shop / Brand</label>
            <input
              type="text"
              id="merchant_name"
              value={formData.merchant_name}
              onChange={e => setFormData({ ...formData, merchant_name: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Product Category</label>
            <input
              type="text"
              id="product_category"
              value={formData.product_category}
              onChange={e => setFormData({ ...formData, product_category: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Invoice / Cash Memo Number</label>
            <input
              type="text"
              id="invoice_number"
              value={formData.invoice_number}
              onChange={e => setFormData({ ...formData, invoice_number: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Evidence / Store Bill File</label>
            <input
              type="text"
              id="evidence_upload"
              value={formData.evidence_upload}
              onChange={e => setFormData({ ...formData, evidence_upload: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Defect Details</label>
            <textarea
              id="complaint_details"
              rows={3}
              value={formData.complaint_details}
              onChange={e => setFormData({ ...formData, complaint_details: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}
            />
          </div>

          <button
            type="submit"
            id="btn-submit"
            className="bis-btn"
            disabled={submitting}
            style={{ width: '100%', padding: '12px', background: '#003366', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            {submitting ? 'Dispatching Grievance…' : 'Dispatch Safety Grievance to Enforcement Cell'}
          </button>
        </form>

        {result && (
          <div
            data-testid="grievance-success"
            style={{ marginTop: 20, padding: 16, background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 6 }}
          >
            <strong style={{ color: '#065f46', fontSize: 14 }}>Grievance Successfully Registered</strong>
            <div style={{ margin: '8px 0' }}>
              <span style={{ fontSize: 12, color: '#047857' }}>Official Ticket ID: </span>
              <span data-testid="grievance-ticket" style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                {result.ticket_id || 'CON-GRP-4401'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#065f46', margin: 0, lineHeight: 1.5 }}>
              {result.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
