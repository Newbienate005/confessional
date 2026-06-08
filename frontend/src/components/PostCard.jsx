// src/components/PostCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { postsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const REACTIONS = [
  { key: 'love',    emoji: '❤️', label: 'Love' },
  { key: 'laugh',   emoji: '😂', label: 'Haha' },
  { key: 'sad',     emoji: '😢', label: 'Sad'  },
  { key: 'shocked', emoji: '😲', label: 'Whoa' },
];

const CATEGORY_COLORS = {
  Relationships: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  School:        'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Family:        'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Work:          'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Mental Health':'text-green-400 bg-green-400/10 border-green-400/20',
  Random:        'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Secrets:       'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function PostCard({ post: initialPost, rank, onUpdate, onDelete }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [post, setPost]         = useState(initialPost);
  const [reacting, setReacting] = useState(false);
  const [reporting, setReporting]  = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportMenu, setShowReportMenu] = useState(false);

  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
    : '';

  const catStyle = CATEGORY_COLORS[post.category] || CATEGORY_COLORS.Random;

  // ── React ────────────────────────────────────────────
  const handleReact = async (type, e) => {
    e.stopPropagation();
    if (!user) { toast.error('Sign in to react'); return; }
    if (reacting) return;
    setReacting(true);
    // Optimistic update
    const prev = post.userReaction;
    const updated = { ...post.reactions };
    if (prev === type) {
      updated[type] = Math.max(0, updated[type] - 1);
      setPost(p => ({ ...p, reactions: updated, userReaction: null, totalReactions: p.totalReactions - 1 }));
    } else {
      if (prev) updated[prev] = Math.max(0, updated[prev] - 1);
      updated[type] = (updated[type] || 0) + 1;
      setPost(p => ({ ...p, reactions: updated, userReaction: type, totalReactions: prev ? p.totalReactions : p.totalReactions + 1 }));
    }
    try {
      const { data } = await postsAPI.react(post.id, type);
      setPost(p => ({ ...p, reactions: data.reactions, userReaction: data.userReaction }));
      if (onUpdate) onUpdate({ ...post, reactions: data.reactions, userReaction: data.userReaction });
    } catch {
      // Revert
      setPost(initialPost);
      toast.error('Failed to react');
    } finally {
      setReacting(false);
    }
  };

  // ── Bookmark ─────────────────────────────────────────
  const handleBookmark = async (e) => {
    e.stopPropagation();
    if (!user) { toast.error('Sign in to bookmark'); return; }
    try {
      const { data } = await postsAPI.bookmark(post.id);
      setPost(p => ({ ...p, isBookmarked: data.bookmarked }));
      toast.success(data.bookmarked ? 'Bookmarked!' : 'Removed bookmark');
      if (onUpdate) onUpdate({ ...post, isBookmarked: data.bookmarked });
    } catch { toast.error('Failed to bookmark'); }
  };

  // ── Report ────────────────────────────────────────────
  const handleReport = async (e) => {
    e.stopPropagation();
    if (!user) { toast.error('Sign in to report'); return; }
    if (!reportReason) { toast.error('Select a reason'); return; }
    setReporting(true);
    try {
      await postsAPI.report(post.id, { reason: reportReason });
      toast.success('Report submitted. Thank you.');
      setShowReportMenu(false);
      setReportReason('');
    } catch { toast.error('Failed to submit report'); }
    finally { setReporting(false); }
  };

  return (
    <article
      className={`bg-[#141417] border border-[#2a2a32] rounded-2xl p-5 mb-3 transition-all duration-200 hover:border-[#3a3a45] hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group animate-fadeIn ${post.id?.startsWith?.('new-') ? 'post-new' : ''}`}
      onClick={() => navigate(`/post/${post.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/post/${post.id}`)}
      aria-label="Open confession"
    >
      {/* Hover gradient top bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c084fc] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Rank number (trending) */}
      {rank && (
        <div className="absolute top-4 right-5 font-serif text-4xl text-[#1c1c21] italic pointer-events-none select-none">
          {rank}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-[#1c1c21] border border-[#2a2a32] rounded-md px-2.5 py-1 text-xs text-[#9896a8]">
          <i className="ti ti-ghost text-[#c084fc]" />
          Anonymous
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${catStyle}`}>
          {post.category}
        </span>
        {post.isBookmarked && (
          <i className="ti ti-bookmark-filled text-[#c084fc] text-sm" aria-label="Bookmarked" />
        )}
        {post.isHidden && user?.role === 'admin' && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Hidden</span>
        )}
        <span className="ml-auto text-xs text-[#5a5868]">{timeAgo}</span>
      </div>

      {/* Content */}
      <p className="confession-text mb-4">
        {post.content?.length > 300 ? post.content.slice(0, 300) + '…' : post.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
        {REACTIONS.map(r => (
          <button
            key={r.key}
            onClick={e => handleReact(r.key, e)}
            title={r.label}
            disabled={reacting}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all
              ${post.userReaction === r.key
                ? 'bg-[#7c3aed]/20 border-[#7c3aed]/40 text-[#c084fc]'
                : 'bg-[#1c1c21] border-[#2a2a32] text-[#9896a8] hover:border-[#3a3a45] hover:text-white hover:scale-105'}`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{(post.reactions?.[r.key] || 0)}</span>
          </button>
        ))}

        {/* Comment count */}
        <button
          onClick={() => navigate(`/post/${post.id}`)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[#1c1c21] border border-[#2a2a32] text-[#9896a8] hover:border-[#3a3a45] hover:text-white transition ml-auto"
        >
          <i className="ti ti-message text-sm" />
          <span>{post.commentCount || 0}</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          title={post.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          className="p-1.5 rounded-lg text-xs bg-[#1c1c21] border border-[#2a2a32] text-[#9896a8] hover:border-[#3a3a45] hover:text-[#c084fc] transition"
        >
          <i className={`ti ${post.isBookmarked ? 'ti-bookmark-filled text-[#c084fc]' : 'ti-bookmark'} text-sm`} />
        </button>

        {/* Report */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowReportMenu(s => !s); }}
            title="Report"
            className="p-1.5 rounded-lg text-xs bg-[#1c1c21] border border-[#2a2a32] text-[#9896a8] hover:border-red-500/30 hover:text-red-400 transition"
          >
            <i className="ti ti-flag text-sm" />
          </button>
          {showReportMenu && (
            <div
              className="absolute bottom-full right-0 mb-2 w-56 bg-[#1c1c21] border border-[#3a3a45] rounded-xl shadow-xl z-50 p-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-xs text-[#9896a8] mb-2 font-medium">Report reason</p>
              {['Hate speech','Spam or scam','False information','Harassment','Graphic content','Self-harm','Other'].map(r => (
                <label key={r} className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-white text-[#9896a8] text-xs transition">
                  <input
                    type="radio"
                    name={`report-${post.id}`}
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="accent-[#7c3aed]"
                  />
                  {r}
                </label>
              ))}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReport}
                  disabled={reporting || !reportReason}
                  className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                >
                  {reporting ? 'Submitting…' : 'Submit'}
                </button>
                <button
                  onClick={() => { setShowReportMenu(false); setReportReason(''); }}
                  className="px-3 py-1.5 text-xs text-[#5a5868] hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Owner delete */}
        {(post.isOwner || user?.role === 'admin') && (
          <button
            onClick={async e => {
              e.stopPropagation();
              if (!confirm('Delete this confession?')) return;
              try { await postsAPI.delete(post.id); toast.success('Deleted'); if (onDelete) onDelete(post.id); }
              catch { toast.error('Failed to delete'); }
            }}
            title="Delete"
            className="p-1.5 rounded-lg text-xs bg-[#1c1c21] border border-[#2a2a32] text-[#5a5868] hover:border-red-500/30 hover:text-red-400 transition"
          >
            <i className="ti ti-trash text-sm" />
          </button>
        )}
      </div>
    </article>
  );
}
