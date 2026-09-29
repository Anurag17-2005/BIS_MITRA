import { useState } from 'react';
import { SECTIONS, ingestPlanIdForCluster } from '../../sections';
import { warehouseViewUrl, isPdfItem, isImageItem } from '../../fileUrls';
import { methodLabel } from '../../methods';

function formatDate(iso) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString();
}

export default function SectionWarehouse({
  clusterId,
  warehouse,
  freshness = [],
  filter = '',
  onPreview,
  onLineage,
  onUpload,
  onJumpToPlan,
  onDelete,
  onRefreshSection,
}) {
  const [openSections, setOpenSections] = useState({});
  const q = filter.trim().toLowerCase();

  const toggle = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));
  };

  return (
    <div className="sections">
      {SECTIONS.map(sec => {
        let items = warehouse.filter(w => w.domain === sec.id);
        if (q) {
          items = items.filter(w =>
            (w.name || '').toLowerCase().includes(q)
            || (w.meta?.title || '').toLowerCase().includes(q)
            || (w.source || '').toLowerCase().includes(q)
          );
        }
        const isOpen = openSections[sec.id] ?? false;
        const planId = ingestPlanIdForCluster(clusterId, sec.id);
        const fresh = freshness.find(f => f.id === sec.id);

        return (
          <div key={sec.id} className={`section ${isOpen ? 'open' : ''}`}>
            <div className="section-header" onClick={() => toggle(sec.id)}>
              <div className="section-title">
                <span className="section-chevron">▶</span>
                <h4>{sec.title}</h4>
                <span className="section-meta">{items.length} file{items.length !== 1 ? 's' : ''}</span>
                {fresh && (
                  <span className={`fresh-badge fresh-${fresh.state}`}>
                    {fresh.state === 'stale' ? 'Stale vs Clone B' : fresh.state === 'empty' ? 'Not fetched' : 'In sync'}
                    {fresh.lastFetchedAt ? ` · ${formatDate(fresh.lastFetchedAt)}` : ''}
                    {fresh.method ? ` · ${methodLabel(fresh.method)}` : ''}
                  </span>
                )}
                <span className="section-tag">{sec.tag}</span>
              </div>
              <div className="section-actions" onClick={e => e.stopPropagation()}>
                {onRefreshSection && planId && (
                  <button type="button" className="btn btn-sm" onClick={() => onRefreshSection(planId)}>
                    Refresh section
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={() => onUpload(sec.id)}>Upload</button>
                {planId && (
                  <button type="button" className="btn btn-sm" onClick={() => onJumpToPlan(planId)}>
                    Linked plan
                  </button>
                )}
              </div>
            </div>
            <div className="section-body">
              <table>
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Source</th><th>Updated</th><th></th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={5}>
                        {sec.ingestPlanBase
                          ? 'No files — run ingest or upload into this section'
                          : 'No files — upload into this section'}
                      </td>
                    </tr>
                  ) : (
                    items.map(item => {
                      const url = warehouseViewUrl(item);
                      return (
                        <tr key={item.id}>
                          <td>
                            <button type="button" className="linkish" onClick={() => onPreview(item)}>
                              {item.name}
                            </button>
                            {item.meta?.title && (
                              <div className="row-sub">{item.meta.title}</div>
                            )}
                          </td>
                          <td>{item.type}</td>
                          <td>
                            <span className={`badge badge-${item.source === 'upload' ? 'upload' : item.source === 'default' ? 'default' : 'fetch'}`}>
                              {item.source === 'default' ? '🔒 default' : (item.source || 'fetch')}
                            </span>
                            {item.fetchMethod && (
                              <div className="row-sub">{methodLabel(item.fetchMethod)}</div>
                            )}
                          </td>
                          <td>{formatDate(item.updatedAt)}</td>
                          <td className="row-actions">
                            <button type="button" className="btn btn-sm" onClick={() => onPreview(item)}>
                              {isPdfItem(item) || isImageItem(item) ? 'Open' : 'View'}
                            </button>
                            {url && (
                              <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">Tab</a>
                            )}
                            <button type="button" className="icon-btn" onClick={() => onLineage(item)} title="Lineage">ⓘ</button>
                            {onDelete && (
                              <button type="button" className="icon-btn danger" onClick={() => onDelete(item)} title="Remove">✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
