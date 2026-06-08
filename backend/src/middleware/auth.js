// src/middleware/auth.js
const { verifyAccessToken } = require('../utils/jwt');
const { query } = require('../config/database');

/**
 * Require valid JWT — attaches req.user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);

    // Verify user still exists and is active
    const { rows } = await query(
      'SELECT id, username, email, role, status, photo_url FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ success: false, error: 'User not found' });
    if (rows[0].status === 'banned') return res.status(403).json({ success: false, error: 'Account banned' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Optional auth — attaches req.user if token present, continues either way
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.slice(7));
      const { rows } = await query(
        'SELECT id, username, email, role, status FROM users WHERE id = $1 AND status = $2',
        [decoded.id, 'active']
      );
      if (rows.length) req.user = rows[0];
    }
  } catch (_) {}
  next();
}

/**
 * Require admin or moderator role
 */
function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
