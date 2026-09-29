import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchNews, createNews, updateNews, deleteNews } from '../api';

export default function News() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const canEdit = searchParams.get('edit') === '1';
  const [form, setForm] = useState({ title: '', summary: '', category: 'General' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchNews().then(data => {
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateNews(editing, form);
      } else {
        await createNews({
          ...form,
          published_at: new Date().toISOString().slice(0, 10),
        });
      }
      setForm({ title: '', summary: '', category: 'General' });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({ title: item.title, summary: item.summary || '', category: item.category || 'General' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this news item?')) return;
    await deleteNews(id);
    load();
  };

  return (
    <div>
      <div className="bis-breadcrumb">
        <a href="/">Home</a> / <span className="active">News &amp; Announcements</span>
      </div>
      <h1 className="bis-page-title">News &amp; Announcements</h1>
      <p style={{ marginBottom: 20, color: '#555', maxWidth: 720 }}>
        Latest updates from the Bureau of Indian Standards.
        {canEdit
          ? ' Editor mode — changes are stored in Clone B SQLite. Refresh the MITRA News ingest to update the warehouse.'
          : ''}
      </p>

      {loading ? <p>Loading…</p> : (
        <div data-testid="news-list" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {items.length === 0 && <p style={{ color: '#888' }}>No news published yet.</p>}
          {items.map(item => (
            <article
              key={item.id}
              data-testid={`news-item-${item.id}`}
              style={{
                background: '#fff', border: '1px solid #ddd', borderLeft: '4px solid #003366',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 11, color: '#003366', fontWeight: 600, textTransform: 'uppercase' }}>
                    {item.category}
                  </span>
                  <h3 data-testid="news-title" style={{ color: '#003366', margin: '4px 0 8px', fontSize: 16 }}>{item.title}</h3>
                  <p data-testid="news-summary" style={{ color: '#444', fontSize: 14, lineHeight: 1.5 }}>{item.summary}</p>
                  <small data-testid="news-date" style={{ color: '#888' }}>Published {item.published_at}</small>
                </div>
                {canEdit && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button type="button" className="bis-btn" onClick={() => startEdit(item)}>Edit</button>
                  <button type="button" className="bis-btn" style={{ background: '#a33' }} onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {canEdit && (
      <div style={{ background: '#f7f9fc', border: '1px solid #c5d0e0', padding: 20, maxWidth: 640 }}>
        <h3 style={{ color: '#003366', marginBottom: 12, fontSize: 15 }}>
          {editing ? 'Edit announcement' : 'Publish new announcement (demo)'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Title</label>
            <input
              data-testid="news-title-input"
              style={{ width: '100%', padding: 8, border: '1px solid #ccc' }}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Summary</label>
            <textarea
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', minHeight: 72 }}
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Category</label>
            <select
              style={{ padding: 8, border: '1px solid #ccc' }}
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option>General</option>
              <option>Standards</option>
              <option>Certification</option>
              <option>Events</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="bis-btn" disabled={saving} data-testid="news-save-btn">
              {editing ? 'Save changes' : 'Publish'}
            </button>
            {editing && (
              <button type="button" className="bis-btn" onClick={() => { setEditing(null); setForm({ title: '', summary: '', category: 'General' }); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      )}
      {!canEdit && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 24 }}>
          <Link to="/news?edit=1">Open demo editor</Link> (not shown on the public page).
        </p>
      )}
    </div>
  );
}
