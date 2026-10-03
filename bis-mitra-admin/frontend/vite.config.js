import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { adminMitraConfig, viteEnvDefines } from '../../scripts/mitra-vercel-env.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../..');
const adminRoot = path.resolve(root, '..');
const pdfjsRoot = path.resolve(adminRoot, 'node_modules/pdfjs-dist');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const mitraConfig = adminMitraConfig(env);

  return {
    plugins: [react()],
    define: {
      __MITRA_CONFIG__: JSON.stringify(mitraConfig),
      ...viteEnvDefines(env, 'admin'),
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
