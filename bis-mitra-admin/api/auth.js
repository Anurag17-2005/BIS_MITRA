import crypto from 'crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || 'mitra';

/** Demo hosted deploy: skip maintainer password gate when explicitly disabled. */
export function authDisabled() {
  return process.env.DISABLE_ADMIN_AUTH === '1'
    || process.env.RENDER === 'true'
    || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

export function expectedToken() {
  return crypto.createHash('sha256').update(`bis-mitra-admin:${PASSWORD}`).digest('hex');
}

export function login(password) {
  if (password !== PASSWORD) {
    const err = new Error('Invalid password');
    err.status = 401;
    throw err;
  }
  return { token: expectedToken() };
}

export function authMiddleware(req, res, next) {
  if (authDisabled()) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expectedToken()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
