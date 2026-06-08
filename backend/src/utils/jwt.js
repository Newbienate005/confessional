// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_SECRET || 'fallback_secret_change_in_prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

/**
 * Generate access token (short-lived, 15m-7d depending on env)
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    ACCESS_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'confessional' }
  );
}

/**
 * Generate refresh token (long-lived, 30 days)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', issuer: 'confessional' }
  );
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'confessional' });
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, { issuer: 'confessional' });
}

/**
 * Generate a secure random token for password reset / email verify
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage (never store plain reset tokens)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
};
