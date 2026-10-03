import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteEnvDefines } from '../scripts/mitra-vercel-env.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  return {
    plugins: [react()],
    define: viteEnvDefines(env, 'user'),
    server: {
      port: 5002,
      proxy: { '/api': 'http://localhost:5050' },
    },
  };
});
