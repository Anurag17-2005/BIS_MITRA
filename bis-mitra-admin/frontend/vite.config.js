import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bis-user': path.resolve(root, '../../bis-mitra-user/src'),
    },
  },
  server: {
    port: 5001,
    proxy: { '/api': 'http://localhost:5050' },
    fs: { allow: [root, path.resolve(root, '../..')] },
  },
});
