import { useState } from 'react';
import * as api from '../../api';

const DEMO_QUERIES = [
  'Which standard applies to safety helmets?',
  'What is the marking fee for IS 15844?',
  'Is CML-DEMO-61001 active?',
  'Find a testing laboratory for this product.',
  'safety helmet head protection',
  'IS DEMO 1001 QCO certification lab',
  'सुरक्षा हेलमेट मानक',
  'Tell me about XYZ123UnknownProduct',
];

function NoneLabel({ value }) {
  if (!value || (Array.isArray(value) && !value.length)) return <span className="trace-none">None</span>;
  return null;
}

function TraceResultList({ items, defaultOpen = false }) {
  if (!items?.length) return <p className="trace-none">None</p>;
  return (
    <div className="trace-result-list">
      {items.map((item, i) => (
        <details key={item.chunkId || item.recordId || i} className="trace-result-item" open={defaultOpen && i === 0}>
          <summary>
            <span className="trace-result-title">{item.title || item.recordId || item.chunkId}</span>
            {item.score != null && <span className="badge badge-ok">{item.score.toFixed(3)}</span>}
            <span className="badge badge-probe">{item.retrievalMethod || item.type}</span>
          </summary>
          <div className="trace-result-body">
            {item.is_number && <p><strong>IS:</strong> {item.is_number}</p>}
            {item.demo_id && <p><strong>demo_id:</strong> {item.demo_id}</p>}
            {item.chunkId && <p><strong>Chunk ID:</strong> {item.chunkId}</p>}
            {item.recordId && <p><strong>Record ID:</strong> {item.recordId}</p>}
            {item.domain && <p><strong>Domain:</strong> {item.domain}</p>}
            {item.section && <p><strong>Section:</strong> {item.section}</p>}
            {item.source_file && <p><strong>Source file:</strong> {item.source_file}</p>}
            {item.source_reference && <p><strong>Reference:</strong> {item.source_reference}</p>}
            {item.textPreview && <p className="trace-preview">{item.textPreview}</p>}
            {item.provenance && (
              <details className="trace-provenance-fold">
                <summary>Provenance</summary>
                <pre className="trace-pre">{JSON.stringify(item.provenance, null, 2)}</pre>
              </details>
            )}
            <div className="trace-actions">
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Open Source</a>
              )}
              {item.source_reference && !item.sourceUrl && (
                <span className="btn btn-sm disabled">Source: {item.source_reference}</span>
              )}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function StageRow({ label, status, detail }) {
  return (
    <div className="trace-stage-row">
      <span className="trace-stage-label">{label}</span>
      <span className={`chip ${status === 'used' ? 'chip-ok' : ''}`}>{status || 'not_used'}</span>
      {detail && <span className="trace-stage-detail">{detail}</span>}
    </div>
  );
}

export default function RetrievalTestPanel({ clusterId }) {
  const [query, setQuery] = useState(DEMO_QUERIES[0]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    mode: 'hybrid',
    topK: 8,
    domain: 'all',
    language: 'all',
    is_number: '',
    lexicalWeight: 55,
    denseWeight: 45,
  });

  const run = async () => {
    if (!query.trim() || !clusterId) return;
    setBusy(true);
    setError('');
    try {
      const filters = {};
      if (config.domain && config.domain !== 'all') filters.domain = config.domain;
      if (config.language && config.language !== 'all') filters.language = config.language;
      if (config.is_number?.trim()) filters.is_number = config.is_number.trim();

      setResult(await api.retrieveTest(query.trim(), clusterId, {
        topK: Number(config.topK) || 8,
        mode: config.mode,
        lexicalWeight: config.lexicalWeight / 100,
        denseWeight: config.denseWeight / 100,
        filters,
      }));
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const idx = result?.indexStatus;
  const stages = result?.stages;
  const counts = result?.counts;
  const understanding = result?.understanding;

  return (
    <section className="retrieval-test-panel">
      <header className="agent-section-head">
        <h2>Retrieval Test / Intelligence</h2>
        <p>See how MITRA moves from a user query to final evidence.</p>
      </header>

      <div className="trace-config-panel">
        <h3>Retrieval Configuration</h3>
        <div className="trace-config-grid">
          <label>
            Mode
            <select className="wh-filter" value={config.mode} onChange={e => setConfig(c => ({ ...c, mode: e.target.value }))}>
              <option value="hybrid">Hybrid (TF-IDF + hash-trick dense)</option>
              <option value="lexical">Lexical only (TF-IDF cosine)</option>
              <option value="dense">Dense only (hash-trick 384-dim)</option>
            </select>
          </label>
          <label>
            Top K
            <input className="wh-filter" type="number" min={1} max={20} value={config.topK}
              onChange={e => setConfig(c => ({ ...c, topK: e.target.value }))} />
          </label>
          <label>
            Domain
            <select className="wh-filter" value={config.domain} onChange={e => setConfig(c => ({ ...c, domain: e.target.value }))}>
              <option value="all">All</option>
              <option value="standards">Standards</option>
              <option value="certification">Certification</option>
              <option value="enforcement">Enforcement</option>
            </select>
          </label>
          <label>
            Language
            <select className="wh-filter" value={config.language} onChange={e => setConfig(c => ({ ...c, language: e.target.value }))}>
              <option value="all">All</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </label>
          <label>
            IS Number
            <input className="wh-filter" placeholder="Optional" value={config.is_number}
              onChange={e => setConfig(c => ({ ...c, is_number: e.target.value }))} />
          </label>
          {config.mode === 'hybrid' && (
            <>
              <label>
                Lexical weight %
                <input className="wh-filter" type="number" min={0} max={100} value={config.lexicalWeight}
                  onChange={e => setConfig(c => ({ ...c, lexicalWeight: Number(e.target.value) }))} />
              </label>
              <label>
                Dense weight %
                <input className="wh-filter" type="number" min={0} max={100} value={config.denseWeight}
                  onChange={e => setConfig(c => ({ ...c, denseWeight: Number(e.target.value) }))} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="wh-filter"
          style={{ flex: 1 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="User query…"
        />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !clusterId} onClick={run}>
          {busy ? 'Running…' : 'Run Retrieval'}
        </button>
      </div>

      <div className="trace-demo-chips">
        {DEMO_QUERIES.map(q => (
          <button key={q} type="button" className="btn btn-sm" disabled={busy} onClick={() => { setQuery(q); }}>
            {q.slice(0, 36)}{q.length > 36 ? '…' : ''}
          </button>
        ))}
      </div>

      {error && <p className="warn">{error}</p>}

      {result && (
        <>
          <div className="trace-summary-bar">
            <div className="trace-summary-row">
              <span className={`chip ${idx?.status === 'LIVE' ? 'chip-ok' : ''}`}>Index: {idx?.status || '—'}</span>
              <span className="chip">Version: {idx?.indexVersion || '—'}</span>
              <span className="chip">Chunks: {idx?.totalChunks ?? '—'}</span>
              <span className="chip">Latency: {result.latency_ms}ms</span>
            </div>
            <div className="trace-summary-row">
              <span className="chip">Intent: {result.intent}</span>
              <span className="chip">Confidence: {result.confidence?.toFixed(2)}</span>
              <span className="chip">Strategy: {result.strategy}</span>
              <span className="chip">Sources: {result.finalEvidence?.length ?? 0}</span>
            </div>
          </div>

          {result.insufficient_evidence && (
            <div className="trace-no-result">
              <strong>No reliable evidence found.</strong>
              <p>Candidates found: {counts?.combined ?? 0} · Final evidence: {counts?.finalEvidence ?? 0}</p>
            </div>
          )}

          <section className="trace-section">
            <h3>Query Understanding</h3>
            <div className="trace-kv">
              <p><strong>Query:</strong> {result.query}</p>
              <p><strong>Intent:</strong> {understanding?.intent || result.intent}</p>
              <p><strong>Entities:</strong>
                {understanding?.entities?.length
                  ? understanding.entities.map(e => `${e.type} → ${e.value}`).join(', ')
                  : <NoneLabel value={null} />}
              </p>
              <p><strong>Identifiers:</strong>
                {understanding?.identifiers
                  ? [
                    ...(understanding.identifiers.isNumbers || []).map(i => `IS: ${i}`),
                    ...(understanding.identifiers.cmlIds || []).map(i => `CML: ${i}`),
                    ...(understanding.identifiers.huidCodes || []).map(i => `HUID: ${i}`),
                  ].join(', ') || <NoneLabel value={null} />
                  : <NoneLabel value={null} />}
              </p>
              <p><strong>Expanded terms:</strong>
                {understanding?.expandedTerms?.length
                  ? understanding.expandedTerms.join(', ')
                  : <NoneLabel value={null} />}
              </p>
            </div>
          </section>

          <section className="trace-section">
            <h3>Retrieval Pipeline</h3>
            <StageRow label="Exact Identifier Lookup" status={stages?.exact?.status}
              detail={stages?.exact?.count ? `Results: ${stages.exact.count}` : null} />
            <StageRow label="Structured API Lookup" status={stages?.structured?.status}
              detail={stages?.structured?.connector || (stages?.structured?.count ? `Results: ${stages.structured.count}` : null)} />
            <StageRow label={`Lexical (${stages?.lexical?.method || 'tfidf_cosine'})`} status={stages?.lexical?.status}
              detail={stages?.lexical?.count ? `Candidates: ${stages.lexical.count}` : null} />
            <StageRow label={`Dense (${stages?.dense?.method || 'hash_trick_dense_384'})`} status={stages?.dense?.status}
              detail={stages?.dense?.count ? `Candidates: ${stages.dense.count}` : null} />
            <StageRow label={`Hybrid Reranking (${stages?.combined?.method || 'hybrid_weighted'})`} status={stages?.combined?.status}
              detail={stages?.reranked ? `Input: ${stages.reranked.input} → Output: ${stages.reranked.output}` : null} />
            <StageRow label="Metadata Filtering" status={stages?.metadataFilter?.status}
              detail={stages?.metadataFilter?.before != null ? `Before: ${stages.metadataFilter.before} → After: ${stages.metadataFilter.after}` : null} />
            <StageRow label="Evidence Selection" status={stages?.evidenceSelection?.status}
              detail={stages?.evidenceSelection ? `Input: ${stages.evidenceSelection.input} → Final: ${stages.evidenceSelection.output}` : null} />
            {stages?.anchorGuard?.rejected && (
              <StageRow label="Anchor Guard (no-result)" status="used" detail={stages.anchorGuard.reason} />
            )}
          </section>

          <section className="trace-section">
            <h3>Before / After Counts</h3>
            <div className="trace-counts-table">
              <div className="trace-count-row"><span>Lexical</span><strong>{counts?.lexical ?? 0}</strong></div>
              <div className="trace-count-row"><span>Dense</span><strong>{counts?.dense ?? 0}</strong></div>
              <div className="trace-count-row"><span>Combined</span><strong>{counts?.combined ?? 0}</strong></div>
              <div className="trace-count-row"><span>Filtered</span><strong>{counts?.filtered ?? 0}</strong></div>
              <div className="trace-count-row"><span>Evidence selection</span><strong>{counts?.evidenceSelection ?? 0}</strong></div>
              <div className="trace-count-row highlight"><span>Final evidence</span><strong>{counts?.finalEvidence ?? 0}</strong></div>
            </div>
          </section>

          <section className="trace-section">
            <h3>A. Exact / Structured Results</h3>
            <TraceResultList items={[
              ...(stages?.exact?.results || []),
              ...(stages?.structured?.results || []),
            ].filter((r, i, arr) => arr.findIndex(x => x.recordId === r.recordId) === i)} />
          </section>

          <section className="trace-section">
            <h3>B. Lexical Results (TF-IDF cosine)</h3>
            <TraceResultList items={stages?.lexical?.candidates} />
          </section>

          <section className="trace-section">
            <h3>C. Dense Results (hash-trick 384-dim)</h3>
            <TraceResultList items={stages?.dense?.candidates} />
          </section>

          <section className="trace-section">
            <h3>D. Filtered Results</h3>
            <TraceResultList items={stages?.metadataFilter?.results} />
          </section>

          <section className="trace-section">
            <h3>E. Reranked Results</h3>
            <TraceResultList items={stages?.reranked?.results} />
          </section>

          <section className="trace-section trace-final-section">
            <h3>F. Final Evidence</h3>
            <TraceResultList items={result.finalEvidence} defaultOpen />
          </section>
        </>
      )}
    </section>
  );
}
