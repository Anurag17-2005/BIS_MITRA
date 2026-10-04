import { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import SectionGolden from './SectionGolden';
import SectionChunks from './SectionChunks';
import RetrievalTestPanel from '../retrieval/RetrievalTestPanel';
import * as api from '../../api';

export default function TransformInspector({ clusterId, onChanged, readOnly = false }) {
  const [status, setStatus] = useState(null);
  const [goldenGrouped, setGoldenGrouped] = useState({ sections: [] });
  const [chunksGrouped, setChunksGrouped] = useState({ sections: [] });
  const [layer, setLayer] = useState('golden');
  const [filter, setFilter] = useState('');
  const [goldenDetail, setGoldenDetail] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchOut, setSearchOut] = useState(null);
  const [searchStage, setSearchStage] = useState('live');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reload = useCallback(async () => {
    const [st, g, c] = await Promise.all([
      api.getTransformStatus(clusterId),
      api.getTransformGoldenGrouped(clusterId),
      api.getTransformChunksGrouped(clusterId),
    ]);
    setStatus(st);
    setGoldenGrouped(g);
    setChunksGrouped(c);
    onChanged?.();
  }, [clusterId, onChanged]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const runStage = async (stage) => {
    setBusy(true);
    setMsg('');
    try {
      await api.runTransform(clusterId, stage);
      setMsg(`Done: ${stage}`);
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openGolden = async (warehouseItemId) => {
    setGoldenDetail(await api.getTransformGoldenRecord(clusterId, warehouseItemId));
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearchOut(await api.searchTransformIndex(clusterId, searchQ.trim(), 5, searchStage));
    setLayer('index');
  };

  const clearAll = async () => {
    if (!confirm('Clear all golden, chunks, and index for this cluster?')) return;
    setBusy(true);
    try {
      await api.clearTransformData(clusterId, ['golden', 'chunks', 'index']);
      setGoldenDetail(null);
      setSearchOut(null);
      setMsg('Cleared');
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="transform-inspector">
      <div className="transform-stats compact">
        <span>Golden <strong>{status?.golden?.count ?? 0}</strong></span>
        <span>Chunks <strong>{status?.chunks?.count ?? 0}</strong></span>
        <span>Index <strong>{status?.index?.live?.chunkCount ?? status?.index?.draft?.chunkCount ?? 0}</strong></span>
      </div>

      {readOnly && (
        <p className="row-sub" style={{ marginBottom: 8 }}>
          Pre-built demo index — browse and test retrieval only. Rebuild is disabled.
        </p>
      )}
      {!readOnly && (
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => runStage('full')}>Full rebuild</button>
          <button className="btn btn-sm" disabled={busy} onClick={() => runStage('golden')}>Golden</button>
          <button className="btn btn-sm" disabled={busy} onClick={() => runStage('chunks')}>Chunks</button>
          <button className="btn btn-sm" disabled={busy} onClick={() => runStage('index')}>Index</button>
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.promoteTransformIndex(clusterId);
                setMsg('Promoted');
                await reload();
              } catch (e) { setMsg(e.message); }
              finally { setBusy(false); }
            }}
          >
            Promote
          </button>
          <button className="btn btn-sm danger" disabled={busy} onClick={clearAll}>Clear all</button>
          {msg && <span className="row-sub">{msg}</span>}
        </div>
      )}

      <div className="transform-tabs">
        {['golden', 'chunks', 'index', 'retrieval'].map(t => (
          <button
            key={t}
            type="button"
            className={`filter-pill ${layer === t ? 'active' : ''}`}
            onClick={() => setLayer(t)}
          >
            {t}
          </button>
        ))}
        <input
          className="wh-filter"
          style={{ marginLeft: 'auto', maxWidth: 220 }}
          placeholder="Filter…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {layer === 'golden' && (
        <SectionGolden grouped={goldenGrouped} filter={filter} onView={openGolden} />
      )}

      {layer === 'chunks' && (
        <SectionChunks grouped={chunksGrouped} filter={filter} />
      )}

      {layer === 'index' && (
        <div>
          <div className="toolbar">
            <input
              className="wh-filter"
              placeholder="Test query…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
            <select className="wh-filter" value={searchStage} onChange={e => setSearchStage(e.target.value)}>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={doSearch}>Search</button>
          </div>
          {searchOut?.results?.map(r => (
            <div key={r.chunkId} className="search-hit">
              <div className="search-hit-head">
                <strong>{r.title}</strong>
                <span className="badge badge-ok">{r.score.toFixed(3)}</span>
                <span className="badge badge-probe">{r.section}</span>
              </div>
              <p>{r.textPreview}</p>
            </div>
          ))}
        </div>
      )}

      {layer === 'retrieval' && (
        <RetrievalTestPanel clusterId={clusterId} />
      )}

      <Modal
        open={!!goldenDetail}
        title={goldenDetail?.title || 'Golden record'}
        onClose={() => setGoldenDetail(null)}
        actions={<button type="button" className="btn" onClick={() => setGoldenDetail(null)}>Close</button>}
      >
        {goldenDetail && (
          <>
            <p className="row-sub">
              {goldenDetail.section} · {goldenDetail.quality?.status}
              {(goldenDetail.isNumbers || []).length ? ` · ${goldenDetail.isNumbers.join(', ')}` : ''}
            </p>
            <div className="preview-box" style={{ maxHeight: 400, overflow: 'auto' }}>
              {goldenDetail.textPreview}
              {goldenDetail.textTruncated && <p className="warn">…truncated</p>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
