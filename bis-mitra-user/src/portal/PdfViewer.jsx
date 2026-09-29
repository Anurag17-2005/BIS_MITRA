import { useEffect, useRef, useState } from 'react';

const N = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function indexPage(items) {
  let acc = '';
  const spans = [];
  items.forEach((item) => {
    const n = N(item.str);
    spans.push({ item, start: acc.length, end: acc.length + n.length });
    acc += n;
  });
  return { acc, spans };
}

function locate(p, idx) {
  const pages = Object.keys(idx).map(Number).sort((a, b) => a - b);
  const rid = N(p.record_id);
  const idPages = rid.length >= 6 ? pages.filter((n) => idx[n].acc.includes(rid)) : [];
  const order = [...new Set([...idPages, ...idPages.map((n) => n + 1), ...pages])].filter((n) => idx[n]);

  for (const ev of (p.evidence || []).map(N).filter((e) => e.length >= 8)) {
    for (const len of [Math.min(ev.length, 80), 60, 50, 32, 18, 12]) {
      const needle = ev.slice(0, len);
      if (needle.length < 8) continue;
      for (const n of order) {
        let at = idx[n].acc.indexOf(needle);
        if (at >= 0) return { page: n, at, len: Math.min(ev.length, 200), estimated: false };
        const trimmed = needle.replace(/^[^a-z0-9]+/i, '');
        if (trimmed.length >= 8 && trimmed !== needle) {
          at = idx[n].acc.indexOf(trimmed);
          if (at >= 0) return { page: n, at, len: Math.min(ev.length, 200), estimated: false };
        }
      }
    }
  }

  if (idPages.length) return { page: idPages[0], estimated: false };
  // Scroll fallback from chunk metadata (may be estimated)
  if (p.page_number) {
    return {
      page: Number(p.page_number),
      estimated: p.page_number_confidence === 'estimated',
    };
  }
  if (p.source?.page_number) {
    return {
      page: Number(p.source.page_number),
      estimated: p.source.page_number_confidence === 'estimated',
    };
  }
  return null;
}

function boxesFor(pdfjs, spans, viewport, at, len) {
  return spans
    .filter((s) => s.end > at && s.start < at + len)
    .map((s) => {
      const tx = pdfjs.Util.transform(viewport.transform, s.item.transform);
      const h = Math.hypot(tx[2], tx[3]) || 12;
      return {
        left: tx[4],
        top: tx[5] - h,
        width: Math.max(8, (s.item.width || 40) * viewport.scale),
        height: h + 2,
      };
    });
}

export default function PdfViewer({
  url,
  title,
  passages,
  activeId,
  onSelect,
  onClose,
  bisUrl,
  openBisLabel = 'Open on BIS',
}) {
  const scrollRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [located, setLocated] = useState({});
  const [marks, setMarks] = useState({});

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setLocated({});
    setMarks({});
    setStatus('loading');

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdfjs.getDocument({ url });
        const pdf = await task.promise;
        if (cancelled) {
          task.destroy();
          return;
        }

        const idx = {};
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          idx[n] = indexPage(content.items);
        }

        const loc = {};
        (passages || []).forEach((p) => {
          loc[p.id] = locate(p, idx);
        });
        if (cancelled) return;
        setLocated(loc);

        const markMap = {};
        const rendered = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 1.25 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const { spans } = idx[n];

          (passages || []).forEach((p) => {
            const L = loc[p.id];
            if (!L || L.page !== n || L.at == null || L.at < 0) return;
            if (!markMap[p.id]) markMap[p.id] = {};
            markMap[p.id][n] = boxesFor(pdfjs, spans, viewport, L.at, L.len || 40);
          });

          rendered.push({
            n,
            url: canvas.toDataURL('image/jpeg', 0.82),
            width: viewport.width,
            height: viewport.height,
          });
          if (cancelled) return;
          setPages([...rendered]);
          setMarks({ ...markMap });
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err?.message || 'Could not open this PDF.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url, passages]);

  const active = (passages || []).find((p) => p.id === activeId) || passages?.[0];
  const activeLoc = active ? located[active.id] : null;

  useEffect(() => {
    if (!scrollRef.current || !pages.length) return;
    const scroller = scrollRef.current;
    const hl = scroller.querySelector('.bp-hl');
    if (hl) {
      hl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (activeLoc?.page) {
      const pageEl = scroller.querySelector(`[data-page="${activeLoc.page}"]`);
      if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeId, pages.length, activeLoc?.page]);

  const pageBadge = activeLoc?.page
    ? (activeLoc.estimated ? `~p. ${activeLoc.page}` : `p. ${activeLoc.page}`)
    : null;

  return (
    <div className="bp-pdf" role="dialog" aria-label="Source document">
      <div className="bp-pdf-box">
        <header>
          <div>
            <strong>{title || 'Source'}</strong>
            <small>
              {pageBadge ? `${pageBadge} · ` : ''}
              {passages?.length || 0} passage{(passages?.length || 0) === 1 ? '' : 's'}
            </small>
          </div>
          <div className="bp-pdf-actions">
            {bisUrl && <a href={bisUrl} target="_blank" rel="noreferrer">{openBisLabel}</a>}
            <a href={url} target="_blank" rel="noreferrer">Open in new tab</a>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>
        {(passages || []).length > 0 && (
          <div className="bp-passages">
            {(passages || []).map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === active?.id ? 'on' : ''}
                onClick={() => onSelect(p.id)}
              >
                <span>{p.label || p.record_id || 'Passage'}</span>
              </button>
            ))}
          </div>
        )}
        {active?.evidence?.[0] && (
          <p className="bp-passage-preview">{active.evidence[0]}</p>
        )}
        <div className="bp-pdf-scroll" ref={scrollRef}>
          {status === 'loading' && pages.length === 0 && <p className="bp-muted">Opening document…</p>}
          {status === 'error' && (
            <div className="bp-pdf-fallback">
              <p>{error}</p>
              <iframe title={title || 'source'} src={url} />
            </div>
          )}
          {pages.map((page) => (
            <div
              key={page.n}
              className="bp-pdf-page"
              data-page={page.n}
              style={{ width: page.width }}
            >
              <img src={page.url} alt={`Page ${page.n}`} width={page.width} height={page.height} />
              {(passages || []).flatMap((p) => {
                const boxes = marks[p.id]?.[page.n] || [];
                if (p.id !== active?.id) return [];
                return boxes.map((box, i) => (
                  <span
                    key={`${p.id}-${i}`}
                    className="bp-hl"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  />
                ));
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
