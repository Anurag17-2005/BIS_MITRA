export const URLS = {
  bis: process.env.BIS_URL || 'http://localhost:3001',
  manak: process.env.MANAK_URL || 'http://localhost:3002',
  standards: process.env.STANDARDS_URL || 'http://localhost:3003',
};

export const FETCH_DIR = new URL('../data/fetched/', import.meta.url).pathname;
