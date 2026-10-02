import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../..');
const adminRoot = path.resolve(root, '..');
const pdfjsRoot = path.resolve(adminRoot, 'node_modules/pdfjs-dist');

export default defineConfig({
  plugins: [react()],
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
});
