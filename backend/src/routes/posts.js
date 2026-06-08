// src/routes/posts.js
const router = require('express').Router();
const { query } = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { postLimiter } = require('../middleware/security');
const { validatePost, validateComment, validateReaction, validateReport, validateUUID } = require('../middleware/validate');

// Helper — format post for API response
function formatPost(row, userId = null) {
  return {
    id: row.id,
    content: row.content,
    category: row.category,
    reactions: {
      love:    parseInt(row.reaction_love)    || 0,
      laugh:   parseInt(row.reaction_laugh)   || 0,
      sad:     parseInt(row.reaction_sad)     || 0,
      shocked: parseInt(row.reaction_shocked) || 0,
    },
    totalReactions: (parseInt(row.reaction_love) + parseInt(row.reaction_laugh) + parseInt(row.reaction_sad) + parseInt(row.reaction_shocked)) || 0,
    commentCount: parseInt(row.comment_count) || 0,
    reportCount:  parseInt(row.report_count)  || 0,
    isHidden:     row.is_hidden || false,
    trendingScore: parseFloat(row.trending_score) || 0,
    userReaction: row.user_reaction || null,
    isBookmarked: row.is_bookmarked || false,
    isOwner: userId ? row.user_id === userId : false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── GET /api/posts ────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const { category, search, sort = 'latest', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user?.id || null;

  try {
    const conditions = ['p.is_hidden = false'];
    const params = [];
    let p = 1;

    if (category && category !== 'All') {
      conditions.push(`p.category = $${p++}`); params.push(category);
    }
    if (search) {
      conditions.push(`(p.content ILIKE $${p} OR p.category ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderBy = sort === 'trending'
      ? 'ORDER BY p.trending_score DESC'
      : 'ORDER BY p.created_at DESC';

    const countQuery = `SELECT COUNT(*) FROM posts p ${where}`;
    const { rows: [{ count }] } = await query(countQuery, params);

    const dataQuery = `
      SELECT
        p.*,
        ${userId ? `r.reaction_type AS user_reaction,` : 'NULL AS user_reaction,'}
        ${userId ? `CASE WHEN b.user_id IS NOT NULL THEN true ELSE false END AS is_bookmarked` : 'false AS is_bookmarked'}
      FROM posts p
      ${userId ? `LEFT JOIN reactions r ON r.post_id = p.id AND r.user_id = $${p}` : ''}
      ${userId ? `LEFT JOIN bookmarks b ON b.post_id = p.id AND b.user_id = $${p + 1}` : ''}
      ${where}
      ${orderBy}
      LIMIT $${userId ? p + 2 : p} OFFSET $${userId ? p + 3 : p + 1}
    `;

    const dataParams = userId
      ? [...params, userId, userId, parseInt(limit), offset]
      : [...params, parseInt(limit), offset];

    const { rows } = await query(dataQuery, dataParams);

    res.json({
      success: true,
      posts: rows.map(r => formatPost(r, userId)),
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ success: false, error: 'Failed to load posts' });
  }
});

// ── POST /api/posts ───────────────────────────────────────
router.post('/', requireAuth, postLimiter, validatePost, async (req, res) => {
  const { content, category = 'Random' } = req.body;
  try {
    const { rows: [post] } = await query(`
      INSERT INTO posts (user_id, content, category)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.user.id, content, category]);

    const formatted = formatPost(post, req.user.id);

    // Emit via Socket.io (attached to req.app)
    const io = req.app.get('io');
    if (io) io.emit('post:new', formatted);

    res.status(201).json({ success: true, post: formatted });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// ── GET /api/posts/:id ────────────────────────────────────
router.get('/:id', optionalAuth, validateUUID('id'), async (req, res) => {
  const userId = req.user?.id || null;
  try {
    const { rows } = await query(`
      SELECT
        p.*,
        ${userId ? `r.reaction_type AS user_reaction,` : 'NULL AS user_reaction,'}
        ${userId ? `CASE WHEN b.user_id IS NOT NULL THEN true ELSE false END AS is_bookmarked` : 'false AS is_bookmarked'}
      FROM posts p
      ${userId ? `LEFT JOIN reactions r ON r.post_id = p.id AND r.user_id = $2` : ''}
      ${userId ? `LEFT JOIN bookmarks b ON b.post_id = p.id AND b.user_id = $3` : ''}
      WHERE p.id = $1 AND p.is_hidden = false
    `, userId ? [req.params.id, userId, userId] : [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Post not found' });

    // Fetch comments
    const { rows: comments } = await query(`
      SELECT id, content, user_id, parent_id, created_at FROM comments
      WHERE post_id = $1 ORDER BY created_at ASC
    `, [req.params.id]);

    res.json({ success: true, post: { ...formatPost(rows[0], userId), comments } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load post' });
  }
});

// ── DELETE /api/posts/:id ─────────────────────────────────
router.delete('/:id', requireAuth, validateUUID('id'), async (req, res) => {
  try {
    const { rows } = await query('SELECT user_id FROM posts WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Post not found' });
    if (rows[0].user_id !== req.user.id && !['admin','moderator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.emit('post:deleted', { id: req.params.id });

    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// ── POST /api/posts/:id/react ─────────────────────────────
router.post('/:id/react', requireAuth, validateUUID('id'), validateReaction, async (req, res) => {
  const { reactionType } = req.body;
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const { rows: [existing] } = await query(
      'SELECT id, reaction_type FROM reactions WHERE user_id=$1 AND post_id=$2',
      [userId, postId]
    );

    let newReaction = null;

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Toggle off
        await query('DELETE FROM reactions WHERE user_id=$1 AND post_id=$2', [userId, postId]);
        await query(`UPDATE posts SET reaction_${reactionType} = GREATEST(0, reaction_${reactionType} - 1) WHERE id=$1`, [postId]);
      } else {
        // Change reaction
        await query('UPDATE reactions SET reaction_type=$1 WHERE user_id=$2 AND post_id=$3', [reactionType, userId, postId]);
        await query(`UPDATE posts SET reaction_${existing.reaction_type} = GREATEST(0, reaction_${existing.reaction_type} - 1), reaction_${reactionType} = reaction_${reactionType} + 1 WHERE id=$1`, [postId]);
        newReaction = reactionType;
      }
    } else {
      await query('INSERT INTO reactions (user_id, post_id, reaction_type) VALUES ($1,$2,$3)', [userId, postId, reactionType]);
      await query(`UPDATE posts SET reaction_${reactionType} = reaction_${reactionType} + 1 WHERE id=$1`, [postId]);
      newReaction = reactionType;
    }

    // Update trending score
    await query(`
      UPDATE posts SET trending_score = calculate_trending_score(
        reaction_love + reaction_laugh + reaction_sad + reaction_shocked,
        comment_count,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
      ) WHERE id=$1
    `, [postId]);

    const { rows: [updated] } = await query('SELECT * FROM posts WHERE id=$1', [postId]);
    const formattedPost = { ...formatPost(updated), userReaction: newReaction };

    const io = req.app.get('io');
    if (io) io.emit('post:updated', { id: postId, reactions: formattedPost.reactions, userReaction: newReaction, totalReactions: formattedPost.totalReactions });

    res.json({ success: true, reactions: formattedPost.reactions, userReaction: newReaction });
  } catch (err) {
    console.error('React error:', err);
    res.status(500).json({ success: false, error: 'Failed to react' });
  }
});

// ── POST /api/posts/:id/comments ──────────────────────────
router.post('/:id/comments', requireAuth, validateUUID('id'), validateComment, async (req, res) => {
  const { content, parentId } = req.body;
  const postId = req.params.id;

  try {
    const { rows: [post] } = await query('SELECT id FROM posts WHERE id=$1 AND is_hidden=false', [postId]);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    const { rows: [comment] } = await query(`
      INSERT INTO comments (post_id, user_id, content, parent_id)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [postId, req.user.id, content, parentId || null]);

    await query(`
      UPDATE posts SET comment_count = comment_count + 1,
        trending_score = calculate_trending_score(
          reaction_love + reaction_laugh + reaction_sad + reaction_shocked,
          comment_count + 1,
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
        ) WHERE id=$1
    `, [postId]);

    const formattedComment = {
      id: comment.id,
      postId,
      content: comment.content,
      parentId: comment.parent_id,
      userId: comment.user_id,
      createdAt: comment.created_at,
      isOwner: true,
    };

    const io = req.app.get('io');
    if (io) io.to(`post:${postId}`).emit('comment:new', formattedComment);

    res.status(201).json({ success: true, comment: formattedComment });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

// ── DELETE /api/posts/:id/comments/:commentId ─────────────
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT user_id, post_id FROM comments WHERE id=$1', [req.params.commentId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id && !['admin','moderator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await query('DELETE FROM comments WHERE id=$1', [req.params.commentId]);
    await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id=$1', [req.params.id]);

    const io = req.app.get('io');
    if (io) io.to(`post:${req.params.id}`).emit('comment:deleted', { id: req.params.commentId, postId: req.params.id });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// ── POST /api/posts/:id/report ────────────────────────────
router.post('/:id/report', requireAuth, validateUUID('id'), validateReport, async (req, res) => {
  const { reason, description } = req.body;
  try {
    await query(
      'INSERT INTO reports (reporter_id, post_id, reason, description) VALUES ($1,$2,$3,$4)',
      [req.user.id, req.params.id, reason, description || null]
    );

    const { rows: [updated] } = await query(
      'UPDATE posts SET report_count = report_count + 1, is_hidden = (report_count + 1 >= 5) WHERE id=$1 RETURNING report_count, is_hidden',
      [req.params.id]
    );

    if (updated?.is_hidden) {
      const io = req.app.get('io');
      if (io) io.emit('post:hidden', { id: req.params.id });
    }

    res.json({ success: true, message: 'Report submitted. Thank you.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

// ── POST /api/posts/:id/bookmark ──────────────────────────
router.post('/:id/bookmark', requireAuth, validateUUID('id'), async (req, res) => {
  const { id: postId } = req.params;
  const userId = req.user.id;
  try {
    const { rows: [existing] } = await query('SELECT * FROM bookmarks WHERE user_id=$1 AND post_id=$2', [userId, postId]);
    if (existing) {
      await query('DELETE FROM bookmarks WHERE user_id=$1 AND post_id=$2', [userId, postId]);
      return res.json({ success: true, bookmarked: false });
    }
    await query('INSERT INTO bookmarks (user_id, post_id) VALUES ($1,$2)', [userId, postId]);
    res.json({ success: true, bookmarked: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to bookmark' });
  }
});

module.exports = router;
