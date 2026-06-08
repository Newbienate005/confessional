// src/middleware/security.js
const rateLimit = require('express-rate-limit');
const xss = require('xss');

// ── Rate Limiters ─────────────────────────────────────────

/** General API rate limiter */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

/** Strict limiter for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

/** Password reset limiter */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, error: 'Too many reset requests. Try again in 1 hour.' },
});

/** Post creation limiter */
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: { success: false, error: 'Slow down! Max 5 posts per minute.' },
});

// ── Input Sanitizer ───────────────────────────────────────

/**
 * Sanitize all string fields in req.body against XSS
 */
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      out[k] = xss(v.trim(), {
        whiteList: {},        // no HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
      });
    } else if (Array.isArray(v)) {
      out[k] = v.map(i => typeof i === 'object' ? sanitizeObject(i) : i);
    } else if (v && typeof v === 'object') {
      out[k] = sanitizeObject(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Error Handler ─────────────────────────────────────────

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ success: false, error: 'Already exists' });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ success: false, error: 'Referenced resource not found' });
  }

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = { apiLimiter, authLimiter, resetLimiter, postLimiter, sanitizeInput, errorHandler };
