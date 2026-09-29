export default function JsonPreview({ content }) {
  if (content == null) return <p className="warn">No payload.</p>;

  const news = content.items;
  if (Array.isArray(news) && news[0]?.title) {
    return (
      <>
        <p style={{ fontSize: 12, color: '#858585', marginBottom: 8 }}>
          {news.length} item{news.length !== 1 ? 's' : ''}
        </p>
        <ul className="preview-list">
          {news.map((n, i) => (
            <li key={n.id || i}>
              <strong>{n.title}</strong>
              {n.published_at && <span> · {n.published_at}</span>}
              {n.summary && <div className="row-sub">{n.summary}</div>}
            </li>
          ))}
        </ul>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--link)' }}>Raw JSON</summary>
          <div className="preview-box preview-box-tall">{JSON.stringify(content, null, 2)}</div>
        </details>
      </>
    );
  }

  const standards = content.standards || content.results;
  if (Array.isArray(standards) && (standards[0]?.is_number || standards[0]?.title)) {
    return (
      <table>
        <thead><tr><th>IS</th><th>Title</th><th>Status</th></tr></thead>
        <tbody>
          {standards.slice(0, 40).map((s, i) => (
            <tr key={s.is_number || i}>
              <td>{s.is_number}</td>
              <td>{s.title}</td>
              <td>{s.status || s.mandatory_voluntary || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const fees = Array.isArray(content) ? content : content.fees;
  if (Array.isArray(fees) && (fees[0]?.fee_amount || fees[0]?.is_number)) {
    return (
      <table>
        <thead><tr><th>IS</th><th>Title</th><th>Fee</th></tr></thead>
        <tbody>
          {fees.map((f, i) => (
            <tr key={f.id || i}>
              <td>{f.is_number}</td>
              <td>{f.title}</td>
              <td>{f.fee_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <div className="preview-box preview-box-tall">{JSON.stringify(content, null, 2)}</div>;
}
