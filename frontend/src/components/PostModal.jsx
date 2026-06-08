// src/components/PostModal.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { postsAPI } from '../utils/api';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PostModal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState('');
  const [sending, setSending]   = useState(false);
  const commentInputRef         = useRef(null);

  useEffect(() => {
    loadPost();
    const socket = getSocket();
    if (socket) {
      socket.emit('post:join', id);
      socket.on('comment:new',     handleNewComment);
      socket.on('comment:deleted', handleDeletedComment);
    }
    return () => {
      if (socket) {
        socket.emit('post:leave', id);
        socket.off('comment:new',     handleNewComment);
        socket.off('comment:deleted', handleDeletedComment);
      }
    };
  }, [id]);

  async function loadPost() {
    try {
      const { data } = await postsAPI.getOne(id);
      setPost(data.post);
    } catch {
      toast.error('Post not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  function handleNewComment(c) {
    if (c.postId !== id) return;
    setPost(p => p ? { ...p, comments: [...(p.comments || []), c], commentCount: (p.commentCount || 0) + 1 } : p);
  }

  function handleDeletedComment({ id: cId }) {
    setPost(p => p ? { ...p, comments: (p.comments || []).filter(c => c.id !== cId), commentCount: Math.max(0, (p.commentCount || 0) - 1) } : p);
  }

  const sendComment = async () => {
    if (!comment.trim()) return;
    if (!user) { toast.error('Sign in to comment'); return; }
    setSending(true);
    try {
      const { data } = await postsAPI.comment(id, { content: comment });
      setComment('');
      // Socket will push the new comment to everyone
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await postsAPI.deleteComment(id, commentId);
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const close = () => navigate(-1);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-[#141417] border border-[#3a3a45] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a32]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#1c1c21] border border-[#2a2a32] rounded-md px-2.5 py-1 text-xs text-[#9896a8]">
              <i className="ti ti-ghost text-[#c084fc]" />
              Anonymous
            </div>
            {post && (
              <span className="text-xs px-2.5 py-1 rounded-full border bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#c084fc]">
                {post.category}
              </span>
            )}
          </div>
          <button onClick={close} className="text-[#5a5868] hover:text-white transition p-1">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
              <div className="skeleton h-4 w-4/6" />
            </div>
          ) : post ? (
            <>
              <p className="text-[15px] leading-[1.8] text-white mb-6">{post.content}</p>

              {/* Reactions */}
              <div className="flex gap-2 flex-wrap mb-6">
                {[{k:'love',e:'❤️'},{k:'laugh',e:'😂'},{k:'sad',e:'😢'},{k:'shocked',e:'😲'}].map(r => (
                  <button
                    key={r.k}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition
                      ${post.userReaction === r.k ? 'bg-[#7c3aed]/20 border-[#7c3aed]/40 text-[#c084fc]' : 'bg-[#1c1c21] border-[#2a2a32] text-[#9896a8] hover:border-[#3a3a45]'}`}
                    onClick={async () => {
                      if (!user) return;
                      try {
                        const { data } = await postsAPI.react(post.id, r.k);
                        setPost(p => ({ ...p, reactions: data.reactions, userReaction: data.userReaction }));
                      } catch {}
                    }}
                  >
                    {r.e} <span className="font-medium">{post.reactions?.[r.k] || 0}</span>
                  </button>
                ))}
                <span className="ml-auto text-xs text-[#5a5868] self-center">
                  {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : ''}
                </span>
              </div>

              {/* Comments */}
              <h3 className="text-sm font-medium text-[#9896a8] mb-3">
                Comments ({post.commentCount || (post.comments || []).length})
              </h3>
              {(post.comments || []).length === 0 ? (
                <p className="text-[#5a5868] text-sm mb-4">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-2.5 mb-4">
                  {(post.comments || []).map(c => (
                    <div key={c.id} className="bg-[#1c1c21] border border-[#2a2a32] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5 text-xs text-[#5a5868]">
                        <i className="ti ti-ghost text-[#c084fc]" />
                        <span>Anonymous</span>
                        <span>·</span>
                        <span>{c.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ''}</span>
                        {(c.userId === user?.id || user?.role === 'admin') && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="ml-auto text-[#5a5868] hover:text-red-400 transition"
                            title="Delete comment"
                          >
                            <i className="ti ti-trash text-xs" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[#e8e6f0] leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Comment input */}
        <div className="px-6 py-4 border-t border-[#2a2a32]">
          {user ? (
            <div className="flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                placeholder="Add a comment…"
                maxLength={500}
                className="flex-1 bg-[#1c1c21] border border-[#2a2a32] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#5a5868] outline-none focus:border-[#7c3aed] transition"
              />
              <button
                onClick={sendComment}
                disabled={!comment.trim() || sending}
                className="bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {sending
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <i className="ti ti-send text-sm" />
                }
              </button>
            </div>
          ) : (
            <p className="text-center text-[#5a5868] text-sm">
              <a href="/login" className="text-[#c084fc] hover:underline">Sign in</a> to comment
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
