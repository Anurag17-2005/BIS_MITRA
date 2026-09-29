import { useState } from 'react';
import { SECTIONS } from '../../sections';

const SECTION_TITLES = Object.fromEntries(SECTIONS.map(s => [s.id, s.title]));

function titleForSection(id) {
  return SECTION_TITLES[id] || id.replace(/-/g, ' ');
}

export default function SectionChunks({ grouped, filter = '' }) {
  const [openSections, setOpenSections] = useState({});
  const [openFiles, setOpenFiles] = useState({});
  const q = filter.trim().toLowerCase();

  const toggleSection = (id) => setOpenSections(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));
  const toggleFile = (key) => setOpenFiles(prev => ({ ...prev, [key]: !(prev[key] ?? false) }));

  const sections = grouped?.sections || [];

  return (
    <div className="sections">
      {sections.length === 0 && (
        <p className="row-sub">No chunks — run Rebuild chunks or Full rebuild.</p>
      )}
      {sections.map(sec => {
        let files = sec.files || [];
        if (q) {
          files = files
            .map(f => ({
              ...f,
              chunks: f.chunks.filter(c =>
                (f.title || '').toLowerCase().includes(q)
                || (c.id || '').toLowerCase().includes(q)
                || (c.textPreview || '').toLowerCase().includes(q)
              ),
            }))
            .filter(f => f.chunks.length > 0 || (f.title || '').toLowerCase().includes(q));
        }
        if (q && !files.length) return null;
        const isOpen = openSections[sec.id] ?? false;
        const chunkCount = files.reduce((n, f) => n + f.chunks.length, 0);

        return (
          <div key={sec.id} className={`section ${isOpen ? 'open' : ''}`}>
            <div className="section-header" onClick={() => toggleSection(sec.id)}>
              <div className="section-title">
                <span className="section-chevron">▶</span>
                <h4>{titleForSection(sec.id)}</h4>
                <span className="section-meta">
                  {files.length} file{files.length !== 1 ? 's' : ''} · {chunkCount} chunk{chunkCount !== 1 ? 's' : ''}
                </span>
                <span className="section-tag">chunk:{sec.id}</span>
              </div>
            </div>
            <div className="section-body section-body-nested">
              {files.length === 0 ? (
                <p className="row-sub" style={{ padding: '8px 12px' }}>No chunks in this section</p>
              ) : (
                files.map(file => {
                  const fileKey = `${sec.id}:${file.warehouseItemId || file.title}`;
                  const fileOpen = openFiles[fileKey] ?? false;
                  return (
                    <div key={fileKey} className={`section nested ${fileOpen ? 'open' : ''}`}>
                      <div className="section-header nested-header" onClick={() => toggleFile(fileKey)}>
                        <div className="section-title">
                          <span className="section-chevron">▶</span>
                          <h4>{file.title}</h4>
                          <span className="section-meta">{file.chunks.length} chunk{file.chunks.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="section-body">
                        <table>
                          <thead>
                            <tr><th>Chunk ID</th><th>#</th><th>Preview</th></tr>
                          </thead>
                          <tbody>
                            {file.chunks.map(c => (
                              <tr key={c.id}>
                                <td><code>{c.id}</code></td>
                                <td>{c.chunkIndex}</td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.textPreview}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
