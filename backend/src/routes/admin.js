// src/routes/admin.js
const router = require('express').Router();
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, reports, banned] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM posts'),
      query("SELECT COUNT(*) FROM reports WHERE status='pending'"),
      query("SELECT COUNT(*) FROM users WHERE status='banned'"),
    ]);
    res.json({
      success: true,
      stats: {
        totalUsers:    parseInt(users.rows[0].count),
        totalPosts:    parseInt(posts.rows[0].count),
        pendingReports:parseInt(reports.rows[0].count),
        bannedUsers:   parseInt(banned.rows[0].count),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load stats' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await query(
      'SELECT id, username, email, role, status, email_verified, last_login_at, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), offset]
    );
    const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM users');
    res.json({ success: true, users: rows, total: parseInt(count) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load users' });
  }
});

// ── PATCH /api/admin/users/:id/ban ────────────────────────
router.patch('/users/:id/ban', async (req, res) => {
  const { status } = req.body; // 'active' or 'banned'
  if (!['active','banned'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ success: false, error: 'Cannot ban yourself' });
  }
  try {
    const { rows } = await query(
      'UPDATE users SET status=$1 WHERE id=$2 RETURNING id, username, status',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    // Invalidate sessions if banned
    if (status === 'banned') await query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// ── GET /api/admin/reports ────────────────────────────────
router.get('/reports', async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await query(`
      SELECT r.*, p.content AS post_content, p.category,
             u.username AS reporter_username
      FROM reports r
      JOIN posts p ON p.id = r.post_id
      JOIN users u ON u.id = r.reporter_id
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [status, parseInt(limit), offset]);
    const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM reports WHERE status=$1', [status]);
    res.json({ success: true, reports: rows, total: parseInt(count) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load reports' });
  }
});

// ── PATCH /api/admin/reports/:id ─────────────────────────
router.patch('/reports/:id', async (req, res) => {
  const { status, hidePost } = req.body;
  try {
    const { rows: [report] } = await query(
      'UPDATE reports SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3 RETURNING *',
      [status, req.user.id, req.params.id]
    );
    if (hidePost && report?.post_id) {
      await query('UPDATE posts SET is_hidden=true WHERE id=$1', [report.post_id]);
      const io = req.app.get('io');
      if (io) io.emit('post:hidden', { id: report.post_id });
    }
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update report' });
  }
});

// ── DELETE /api/admin/posts/:id ───────────────────────────
router.delete('/posts/:id', async (req, res) => {
  try {
    await query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.emit('post:deleted', { id: req.params.id });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// ── GET /api/admin/trending ───────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, content, category, reaction_love, reaction_laugh, reaction_sad, reaction_shocked, comment_count, report_count, trending_score, created_at FROM posts WHERE is_hidden=false ORDER BY trending_score DESC LIMIT 10'
    );
    res.json({ success: true, posts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load trending' });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────
// src/routes/users.js
const userRouter = require('express').Router();

userRouter.use(requireAuth);

// GET /api/users/me/posts
userRouter.get('/me/posts', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM posts WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, posts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load your posts' });
  }
});

// GET /api/users/me/bookmarks
userRouter.get('/me/bookmarks', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*, r.reaction_type AS user_reaction, true AS is_bookmarked
      FROM bookmarks b
      JOIN posts p ON p.id = b.post_id
      LEFT JOIN reactions r ON r.post_id = p.id AND r.user_id = $1
      WHERE b.user_id = $1 AND p.is_hidden = false
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, posts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load bookmarks' });
  }
});

// GET /api/users/me/stats
userRouter.get('/me/stats', async (req, res) => {
  try {
    const [postsRes, reactionsRes, commentsRes] = await Promise.all([
      query('SELECT COUNT(*) FROM posts WHERE user_id=$1', [req.user.id]),
      query('SELECT COALESCE(SUM(reaction_love+reaction_laugh+reaction_sad+reaction_shocked),0) AS total FROM posts WHERE user_id=$1', [req.user.id]),
      query('SELECT COUNT(*) FROM comments WHERE user_id=$1', [req.user.id]),
    ]);
    res.json({
      success: true,
      stats: {
        posts:     parseInt(postsRes.rows[0].count),
        reactions: parseInt(reactionsRes.rows[0].total),
        comments:  parseInt(commentsRes.rows[0].count),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load stats' });
  }
});

module.exports = { adminRouter: router, userRouter };
