import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../..');
const adminRoot = path.resolve(root, '..');
const pdfjsRoot = path.resolve(adminRoot, 'node_modules/pdfjs-dist');

function pickEnv(env, key, fallback = '') {
  const v = process.env[key] || env[key] || fallback;
  return String(v).replace(/\/$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const apiUrl = pickEnv(env, 'ADMIN_API_URL', pickEnv(env, 'VITE_API_URL', ''));
  const userPortalUrl = pickEnv(env, 'ADMIN_USER_PORTAL_URL', pickEnv(env, 'VITE_USER_PORTAL_URL', 'http://localhost:5002'));
  const bisUrl = pickEnv(env, 'ADMIN_BIS_URL', pickEnv(env, 'VITE_BIS_URL', 'http://localhost:3001'));

  const mitraConfig = { apiUrl, userPortalUrl, bisUrl };

  return {
    plugins: [react()],
    define: {
      __MITRA_CONFIG__: JSON.stringify(mitraConfig),
      // Embedded bis-mitra-user portal reads VITE_* at build time
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_BIS_URL': JSON.stringify(bisUrl),
      'import.meta.env.VITE_BIS_API': JSON.stringify(pickEnv(env, 'ADMIN_CLONE_API_URL', pickEnv(env, 'VITE_BIS_API', 'http://localhost:4000'))),
      'import.meta.env.VITE_MANAK_URL': JSON.stringify(pickEnv(env, 'ADMIN_MANAK_URL', pickEnv(env, 'VITE_MANAK_URL', 'http://localhost:3002'))),
    },
    resolve: {
      alias: {
        '@bis-user': path.resolve(repoRoot, 'bis-mitra-user/src'),
        'pdfjs-dist': pdfjsRoot,
      },
    },
    server: {
      port: 5001,
      proxy: { '/api': 'http://localhost:5050' },
      fs: { allow: [root, path.resolve(root, '../..')] },
    },
  };
});
