import crypto from 'crypto';

export function hashContent(text) {
  const normalized = (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
