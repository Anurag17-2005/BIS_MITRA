function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function LineagePanel({ lineage }) {
  if (!lineage) return null;

  const { catalog, steps, chunks } = lineage;

  return (
    <div className="lineage-panel">
      <div className="lineage-chain">
        {steps.map((s, i) => (
          <div key={s.id} className="lineage-step">
            <div className="lineage-step-marker">{i + 1}</div>
            <div className="lineage-step-body">
              <div className="lineage-step-label">{s.label}</div>
              <div className="lineage-step-value">{s.value}</div>
              {s.meta && <div className="lineage-step-meta">{s.meta}</div>}
            </div>
          </div>
        ))}
      </div>

      {catalog?.content_sha256 && (
        <div className="lineage-meta-grid">
          <span>SHA <code>{catalog.content_sha256.slice(0, 16)}…</code></span>
          <span>License <code>{catalog.license_class}</code></span>
          <span>Fetched {fmt(catalog.fetched_at)}</span>
          {catalog.fetch_id && <span>Fetch <code>{catalog.fetch_id}</code></span>}
        </div>
      )}

      {chunks?.length > 0 && (
        <details className="lineage-details">
          <summary>{chunks.length} indexed chunk(s)</summary>
          <ul className="agent-sources">
            {chunks.slice(0, 5).map(c => (
              <li key={c.id}>{c.id} · {c.textPreview}…</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
