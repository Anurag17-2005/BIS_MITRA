/* global __MITRA_CONFIG__ */
/**
 * Build-time public URLs (injected in vite.config.js from ADMIN_* env on Vercel — not VITE_ prefix).
 * API URL is still visible in the browser network tab; it is not a secret.
 */
export const config = {
  apiUrl: '',
  userPortalUrl: 'http://localhost:5002',
  bisUrl: 'http://localhost:3001',
  ...(typeof __MITRA_CONFIG__ !== 'undefined' ? __MITRA_CONFIG__ : {}),
};

export function apiUrlConfigured() {
  if (config.apiUrl) return true;
  // Vite dev proxies /api → localhost:5050 when apiUrl is empty
  return import.meta.env.DEV;
}
