/** Runtime URL overrides from GET /api/portal/config (production-safe without Vite rebuild). */

const defaults = {
  bisWeb: (import.meta.env.VITE_BIS_URL || 'http://localhost:3001').replace(/\/$/, ''),
  manakWeb: (import.meta.env.VITE_MANAK_URL || 'http://localhost:3002').replace(/\/$/, ''),
  cloneFiles: null,
};

let runtime = { ...defaults };

export function applyPortalConfig(cfg = {}) {
  if (cfg.bisWebUrl) runtime.bisWeb = String(cfg.bisWebUrl).replace(/\/$/, '');
  if (cfg.manakWebUrl) runtime.manakWeb = String(cfg.manakWebUrl).replace(/\/$/, '');
  if (cfg.cloneFilesBase) runtime.cloneFiles = String(cfg.cloneFilesBase).replace(/\/$/, '');
}

export function getBisWeb() {
  return runtime.bisWeb || defaults.bisWeb;
}

export function getManakWeb() {
  return runtime.manakWeb || defaults.manakWeb;
}

export function getCloneFilesBase() {
  if (runtime.cloneFiles) return runtime.cloneFiles;
  const explicit = import.meta.env.VITE_CLONE_FILES || import.meta.env.VITE_FILES_URL;
  if (explicit) return String(explicit).replace(/\/$/, '');
  const api = (import.meta.env.VITE_BIS_API || 'http://localhost:4000').replace(/\/$/, '');
  return `${api}/files`;
}
