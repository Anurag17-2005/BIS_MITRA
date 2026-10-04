import { unpublishAll } from '../../bis-mitra-admin/api/tests/helpers/cluster-api.mjs';

export default async function globalTeardown() {
  if (process.env.TEST_LEAVE_PUBLISHED === '1') return;
  process.env.ADMIN_API = process.env.ADMIN_API || 'http://127.0.0.1:5050';
  try {
    await unpublishAll();
  } catch {
    /* ignore */
  }
}
