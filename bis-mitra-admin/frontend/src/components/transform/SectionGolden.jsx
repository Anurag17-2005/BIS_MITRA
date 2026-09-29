import { useState } from 'react';
import { SECTIONS } from '../../sections';

const SECTION_TITLES = Object.fromEntries(SECTIONS.map(s => [s.id, s.title]));

function titleForSection(id) {
  return SECTION_TITLES[id] || id.replace(/-/g, ' ');
}

export default function SectionGolden({ grouped, filter = '', onView }) {
  const [openSections, setOpenSections] = useState({});
  const q = filter.trim().toLowerCase();

  const toggle = (id) => setOpenSections(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));

  const sections = grouped?.sections || [];

  return (
    <div className="sections">
      {sections.length === 0 && (
        <p className="row-sub">No golden records — run Rebuild golden or Full rebuild.</p>
      )}
      {sections.map(sec => {
        let items = sec.items || [];
        if (q) {
          items = items.filter(g =>
            (g.title || '').toLowerCase().includes(q)
            || (g.warehouseItemId || '').toLowerCase().includes(q)
            || (g.isNumbers || []).join(' ').toLowerCase().includes(q)
          );
        }
        if (q && !items.length) return null;
        const isOpen = openSections[sec.id] ?? false;

        return (
          <div key={sec.id} className={`section ${isOpen ? 'open' : ''}`}>
            <div className="section-header" onClick={() => toggle(sec.id)}>
              <div className="section-title">
                <span className="section-chevron">▶</span>
                <h4>{titleForSection(sec.id)}</h4>
                <span className="section-meta">{items.length} file{items.length !== 1 ? 's' : ''}</span>
                <span className="section-tag">chunk:{sec.id}</span>
              </div>
            </div>
            <div className="section-body">
              <table>
                <thead>
                  <tr><th>Source file</th><th>Quality</th><th>Text</th><th>IS numbers</th><th></th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr className="empty-row"><td colSpan={5}>No golden records in this section</td></tr>
                  ) : (
                    items.map(g => (
                      <tr key={g.warehouseItemId || g.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => onView(g.warehouseItemId)}>
                            {g.title}
                          </button>
                          <div className="row-sub">{g.warehouseItemId}</div>
                        </td>
                        <td>
                          <span className={`badge badge-${g.quality === 'ok' ? 'ok' : g.quality === 'duplicate' ? 'probe' : 'probe'}`}>
                            {g.quality || '—'}
                          </span>
                        </td>
                        <td>{g.textLength?.toLocaleString() ?? '—'} chars</td>
                        <td className="row-sub">{(g.isNumbers || []).slice(0, 3).join(', ') || '—'}</td>
                        <td>
                          <button type="button" className="btn btn-sm" onClick={() => onView(g.warehouseItemId)}>View</button>
                        </td>
                      </tr>
                    ))
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
