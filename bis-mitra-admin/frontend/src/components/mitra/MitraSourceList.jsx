import { sourceDisplayTitle, sourceToPdfUrl } from './sourceUrl';

export default function MitraSourceList({ sources, onOpenSource }) {
  if (!sources?.length) return null;
  return (
    <div className="mitra-sources">
      <div className="mitra-sources-label">Sources</div>
      <ul>
        {sources.map((s, i) => {
          const url = sourceToPdfUrl(s);
          const title = sourceDisplayTitle(s);
          return (
            <li key={s.chunkId || s.recordId || i}>
              {url ? (
                <button type="button" className="mitra-source-link" onClick={() => onOpenSource?.(s, url)}>
                  📄 {title}
                </button>
              ) : (
                <span>{title}</span>
              )}
              {s.section && <span className="mitra-source-meta"> · {s.section}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
