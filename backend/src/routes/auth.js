// src/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken,
        generateSecureToken, hashToken } = require('../utils/jwt');
const { sendPasswordResetEmail, sendEmailVerification, sendWelcomeEmail } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, resetLimiter } = require('../middleware/security');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require('../middleware/validate');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const LOCKOUT_MINS = parseInt(process.env.LOGIN_LOCKOUT_MINUTES) || 15;
const RESET_EXPIRES_MINS = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES) || 60;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helper: build safe user object ────────────────────────
function safeUser(u) {
  return { id: u.id, username: u.username, email: u.email, role: u.role, status: u.status, photo_url: u.photo_url, email_verified: u.email_verified, created_at: u.created_at };
}

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', authLimiter, validateRegister, async (req, res) => {
  const { username, email, password, acceptedTerms, ipAddress } = req.body;
  try {
    // Check duplicates
    const { rows: existing } = await query(
      'SELECT id, email, username FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    if (existing.length) {
      const field = existing[0].email === email.toLowerCase() ? 'email' : 'username';
      return res.status(409).json({ success: false, error: `That ${field} is already registered` });
    }

    const passwordHash = await bcrypt.hash(password, ROUNDS);
    const verifyToken  = generateSecureToken();
    const verifyHash   = hashToken(verifyToken);

    const { rows: [user] } = await query(`
      INSERT INTO users (username, email, password_hash, email_verify_token, email_verified)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, role, status, email_verified, created_at
    `, [username, email.toLowerCase(), passwordHash, verifyHash, false]);

    // Record terms acceptance
    await query(
      'INSERT INTO terms_acceptance (user_id, version, ip_address, user_agent) VALUES ($1,$2,$3,$4)',
      [user.id, '1.0', req.ip, req.headers['user-agent'] || '']
    );

    // Send verification email (non-blocking)
    sendEmailVerification(user.email, username, verifyToken).catch(console.error);
    sendWelcomeEmail(user.email, username).catch(console.error);

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash  = hashToken(refreshToken);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, refreshHash, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    res.status(201).json({ success: true, message: 'Account created! Please verify your email.', accessToken, refreshToken, user: safeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  const { identifier, password } = req.body;
  try {
    // Find by email or username
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [identifier.toLowerCase()]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const user = rows[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(403).json({ success: false, error: `Account locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ success: false, error: 'This account has been banned.' });
    }

    // Verify password
    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'This account uses Google Sign-In. Please use that instead.' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINS * 60 * 1000);
        await query('UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3', [attempts, lockedUntil, user.id]);
        return res.status(403).json({ success: false, error: `Too many failed attempts. Account locked for ${LOCKOUT_MINS} minutes.` });
      }
      await query('UPDATE users SET failed_login_attempts=$1 WHERE id=$2', [attempts, user.id]);
      return res.status(401).json({ success: false, error: `Invalid credentials (${MAX_ATTEMPTS - attempts} attempts remaining)` });
    }

    // Reset failures, update last login
    await query('UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login_at=NOW() WHERE id=$1', [user.id]);

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash  = hashToken(refreshToken);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, refreshHash, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    res.json({ success: true, accessToken, refreshToken, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/google ─────────────────────────────────
router.post('/google', authLimiter, async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ success: false, error: 'Google ID token required' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    // Find or create user
    let { rows } = await query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2',
      [googleId, email.toLowerCase()]
    );

    let user;
    if (rows.length) {
      user = rows[0];
      // Link Google ID if not already
      if (!user.google_id) {
        await query('UPDATE users SET google_id=$1, photo_url=$2, email_verified=true WHERE id=$3', [googleId, picture, user.id]);
      }
      await query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);
    } else {
      // Create new Google account
      const username = await generateUniqueUsername(name);
      const { rows: [newUser] } = await query(`
        INSERT INTO users (username, email, google_id, photo_url, email_verified, role, status)
        VALUES ($1,$2,$3,$4,true,'user','active') RETURNING *
      `, [username, email.toLowerCase(), googleId, picture]);
      user = newUser;

      // Record terms acceptance (Google users implicitly accept)
      await query(
        'INSERT INTO terms_acceptance (user_id, version, ip_address) VALUES ($1,$2,$3)',
        [user.id, '1.0', req.ip]
      );
      sendWelcomeEmail(user.email, username).catch(console.error);
    }

    if (user.status === 'banned') {
      return res.status(403).json({ success: false, error: 'This account has been banned.' });
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash  = hashToken(refreshToken);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, refreshHash, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    res.json({ success: true, accessToken, refreshToken, user: safeUser(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    if (err.message?.includes('Token used too late')) {
      return res.status(401).json({ success: false, error: 'Google token expired. Please try again.' });
    }
    res.status(401).json({ success: false, error: 'Google authentication failed.' });
  }
});

async function generateUniqueUsername(displayName) {
  const base = (displayName || 'User').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'User';
  let username = base;
  let counter = 0;
  while (true) {
    const { rows } = await query('SELECT id FROM users WHERE username=$1', [username]);
    if (!rows.length) return username;
    counter++;
    username = base + Math.floor(Math.random() * 9000 + 1000);
    if (counter > 10) username = 'User' + Date.now().toString().slice(-6);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, error: 'Refresh token required' });
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const { rows: [session] } = await query(
      'SELECT * FROM user_sessions WHERE refresh_token_hash=$1 AND expires_at > NOW()',
      [tokenHash]
    );
    if (!session) return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });

    const { rows: [user] } = await query('SELECT * FROM users WHERE id=$1 AND status=$2', [decoded.id, 'active']);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    await query('UPDATE user_sessions SET last_used_at=NOW() WHERE id=$1', [session.id]);
    const newAccessToken = generateAccessToken(user);

    res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token refresh failed' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────
router.post('/forgot-password', resetLimiter, validateForgotPassword, async (req, res) => {
  const { email } = req.body;
  // Always return same response to prevent user enumeration
  const successMsg = 'If an account exists with that email, a reset link has been sent.';
  try {
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!rows.length) return res.json({ success: true, message: successMsg });

    const user = rows[0];
    if (!user.password_hash) {
      return res.json({ success: true, message: 'This account uses Google Sign-In. No password reset needed.' });
    }

    // Invalidate previous tokens
    await query('UPDATE password_reset_tokens SET used=true WHERE user_id=$1 AND used=false', [user.id]);

    const token     = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_MINS * 60 * 1000);

    await query(
      'INSERT INTO password_reset_tokens (user_id, token, token_hash, expires_at) VALUES ($1,$2,$3,$4)',
      [user.id, token.slice(0, 8) + '...', tokenHash, expiresAt]
    );

    await sendPasswordResetEmail(user.email, user.username, token);
    res.json({ success: true, message: successMsg });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json({ success: true, message: successMsg }); // Don't expose errors
  }
});

// ── POST /api/auth/reset-password ────────────────────────
router.post('/reset-password', validateResetPassword, async (req, res) => {
  const { token, password } = req.body;
  try {
    const tokenHash = hashToken(token);
    const { rows: [resetRecord] } = await query(`
      SELECT prt.*, u.id as uid, u.username, u.email
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash=$1 AND prt.used=false AND prt.expires_at > NOW()
    `, [tokenHash]);

    if (!resetRecord) {
      return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, ROUNDS);
    await query('UPDATE users SET password_hash=$1, failed_login_attempts=0, locked_until=NULL WHERE id=$2', [passwordHash, resetRecord.uid]);
    await query('UPDATE password_reset_tokens SET used=true WHERE token_hash=$1', [tokenHash]);
    // Invalidate all sessions
    await query('DELETE FROM user_sessions WHERE user_id=$1', [resetRecord.uid]);

    res.json({ success: true, message: 'Password updated successfully. Please sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: 'Password reset failed.' });
  }
});

// ── GET /api/auth/verify-email ────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  try {
    const tokenHash = hashToken(token);
    const { rows } = await query(
      'SELECT id FROM users WHERE email_verify_token=$1 AND email_verified=false',
      [tokenHash]
    );
    if (!rows.length) return res.status(400).json({ success: false, error: 'Invalid or already used verification link.' });

    await query('UPDATE users SET email_verified=true, email_verify_token=NULL WHERE id=$1', [rows[0].id]);
    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await query('DELETE FROM user_sessions WHERE refresh_token_hash=$1', [tokenHash]).catch(() => {});
  }
  res.json({ success: true, message: 'Logged out' });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, user: safeUser(req.user) });
});

module.exports = router;
