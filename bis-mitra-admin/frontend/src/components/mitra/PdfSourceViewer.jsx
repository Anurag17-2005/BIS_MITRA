import { sourceDisplayTitle } from './sourceUrl';

export default function PdfSourceViewer({ source, url, onClose }) {
  if (!url) return null;
  const title = sourceDisplayTitle(source);
  const excerpt = source?.textPreview || source?.citationAnchor || '';

  return (
    <div className="mitra-pdf-overlay" role="dialog" aria-label="PDF source viewer">
      <div className="mitra-pdf-modal">
        <header className="mitra-pdf-header">
          <div>
            <h3>{title}</h3>
            {source?.section && <p className="mitra-panel-meta">{source.section}</p>}
          </div>
          <button type="button" className="mitra-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="mitra-pdf-body">
          <div className="mitra-pdf-frame-wrap">
            <iframe title={title} src={url} className="mitra-pdf-frame" />
          </div>
          {excerpt && (
            <aside className="mitra-pdf-excerpt">
              <div className="mitra-panel-head">Cited passage</div>
              <p className="mitra-pdf-highlight">{excerpt}</p>
              <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">Open in new tab</a>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
