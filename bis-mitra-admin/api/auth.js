import crypto from 'crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || 'mitra';

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
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expectedToken()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
