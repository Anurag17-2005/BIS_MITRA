/**
 * Vercel shared env (REND_* / URL_*) → Vite import.meta.env.VITE_* at build time.
 * Fallback chain keeps ADMIN_* and legacy VITE_* working during migration.
 */

function trimSlash(v) {
  return String(v || '').replace(/\/$/, '');
}

/** First non-empty value from process.env / loaded .env file. Last arg may be default string. */
export function pickEnv(env, ...keysAndDefault) {
  const keys = keysAndDefault.filter((k) => typeof k === 'string');
  const last = keysAndDefault[keysAndDefault.length - 1];
  const fallback = keys.length < keysAndDefault.length && typeof last === 'string' ? last : '';

  for (const key of keys) {
    const raw = process.env[key] ?? env[key];
    if (raw != null && String(raw).trim() !== '') return trimSlash(raw);
  }
  return fallback ? trimSlash(fallback) : '';
}

export function resolveAdminApi(env) {
  return pickEnv(env, 'REND_ADMIN_API', 'ADMIN_API_URL', 'VITE_API_URL', '');
}

export function resolveCloneApi(env) {
  return pickEnv(
    env,
    'REND_CLONE_API',
    'ADMIN_CLONE_API_URL',
    'VITE_BIS_API',
    'http://localhost:4000',
  );
}

export function resolveCloneFiles(env) {
  const explicit = pickEnv(env, 'REND_CLONE_FILES', 'VITE_FILES_URL', '');
  if (explicit) return explicit;
  const base = pickEnv(env, 'REND_CLONE_API', 'ADMIN_CLONE_API_URL', 'VITE_BIS_API', '');
  if (base) return `${trimSlash(base)}/files`;
  return 'http://localhost:4000/files';
}

export function resolveUrlUser(env) {
  return pickEnv(env, 'URL_USER', 'ADMIN_USER_PORTAL_URL', 'VITE_USER_PORTAL_URL', 'http://localhost:5002');
}

export function resolveUrlBis(env) {
  return pickEnv(env, 'URL_BIS', 'ADMIN_BIS_URL', 'VITE_BIS_URL', 'http://localhost:3001');
}

export function resolveUrlManak(env) {
  return pickEnv(env, 'URL_MANAK', 'ADMIN_MANAK_URL', 'VITE_MANAK_URL', 'http://localhost:3002');
}

export function resolveUrlStandards(env) {
  return pickEnv(env, 'URL_STANDARDS', 'VITE_STANDARDS_URL', 'http://localhost:3003');
}

/** @param {'user'|'admin'|'clone-bis'|'clone-manak'|'clone-standards'} profile */
export function viteEnvDefines(env, profile) {
  const d = {};
  const set = (key, value) => {
    d[`import.meta.env.${key}`] = JSON.stringify(value);
  };

  switch (profile) {
    case 'user':
      set('VITE_API_URL', resolveAdminApi(env));
      set('VITE_BIS_API', resolveCloneApi(env));
      set('VITE_BIS_URL', resolveUrlBis(env));
      set('VITE_MANAK_URL', resolveUrlManak(env));
      break;
    case 'admin': {
      const apiUrl = resolveAdminApi(env);
      set('VITE_API_URL', apiUrl);
      set('VITE_BIS_URL', resolveUrlBis(env));
      set('VITE_BIS_API', resolveCloneApi(env));
      set('VITE_MANAK_URL', resolveUrlManak(env));
      break;
    }
    case 'clone-bis':
      set(
        'VITE_API_URL',
        pickEnv(env, 'REND_CLONE_API', 'ADMIN_CLONE_API_URL', 'VITE_BIS_API', 'VITE_API_URL', 'http://localhost:4000'),
      );
      set('VITE_MANAK_URL', resolveUrlManak(env));
      set('VITE_STANDARDS_URL', resolveUrlStandards(env));
      break;
    case 'clone-manak':
      set(
        'VITE_API_URL',
        pickEnv(env, 'REND_CLONE_API', 'ADMIN_CLONE_API_URL', 'VITE_BIS_API', 'VITE_API_URL', 'http://localhost:4000'),
      );
      set('VITE_BIS_URL', resolveUrlBis(env));
      break;
    case 'clone-standards':
      set(
        'VITE_API_URL',
        pickEnv(env, 'REND_CLONE_API', 'ADMIN_CLONE_API_URL', 'VITE_BIS_API', 'VITE_API_URL', 'http://localhost:4000'),
      );
      set('VITE_FILES_URL', resolveCloneFiles(env));
      set('VITE_BIS_URL', resolveUrlBis(env));
      set('VITE_MANAK_URL', resolveUrlManak(env));
      break;
    default:
      throw new Error(`Unknown mitra env profile: ${profile}`);
  }
  return d;
}

export function adminMitraConfig(env) {
  return {
    apiUrl: resolveAdminApi(env),
    userPortalUrl: resolveUrlUser(env),
    bisUrl: resolveUrlBis(env),
  };
}
