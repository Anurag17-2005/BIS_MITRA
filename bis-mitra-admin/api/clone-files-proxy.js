import fs from 'fs';
import path from 'path';

function cloneApiBase() {
  return (process.env.CLONE_API || process.env.CLONE_PUBLIC_URL || '').replace(/\/$/, '');
}

/**
 * Serve a file from local disk when present; otherwise proxy from Clone API /files/...
 */
export function createCloneFilesHandler(localRoot, { filesPrefix = '' } = {}) {
  return async (req, res) => {
    const rel = String(req.path || '').replace(/^\/+/, '');
    const localPath = path.join(localRoot, rel);
    try {
      if (rel && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        return res.sendFile(localPath);
      }
    } catch {
      /* fall through to proxy */
    }

    const clone = cloneApiBase();
    if (!clone) {
      return res.status(404).send(`Cannot GET ${req.originalUrl}`);
    }

    const remoteRel = filesPrefix ? `${filesPrefix}/${rel}`.replace(/\/+/g, '/') : rel;
    const remoteUrl = `${clone}/files/${remoteRel}`.replace(/([^:]\/)\/+/g, '$1');

    try {
      const upstream = await fetch(remoteUrl);
      if (!upstream.ok) {
        return res.status(upstream.status === 404 ? 404 : 502).send(`Cannot GET ${req.originalUrl}`);
      }
      const ct = upstream.headers.get('content-type');
      if (ct) res.set('Content-Type', ct);
      res.set('Cache-Control', 'public, max-age=3600');
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.send(buf);
    } catch (err) {
      return res.status(502).json({ error: 'Clone file proxy failed', detail: err.message });
    }
  };
}

export function resolveCloneFilesPublicBase() {
  const explicit = process.env.CLONE_FILES_URL || process.env.CLONE_FILES_PUBLIC;
  if (explicit) return String(explicit).replace(/\/$/, '');
  const clone = cloneApiBase();
  return clone ? `${clone}/files` : null;
}

export function resolveBisWebUrl() {
  return (process.env.URL_BIS || process.env.BIS_WEB_URL || process.env.BIS_WEB || '').replace(/\/$/, '') || null;
}

export function resolveManakWebUrl() {
  return (process.env.URL_MANAK || process.env.MANAK_WEB_URL || '').replace(/\/$/, '') || null;
}
