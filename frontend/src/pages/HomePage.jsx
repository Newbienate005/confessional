// src/pages/HomePage.jsx
import { useState, useEffect, useCallback } from 'react';
import { postsAPI } from '../utils/api';
import { getSocket } from '../utils/socket';
import PostCard from '../components/PostCard';
import toast from 'react-hot-toast';

const CATS = ['All','Relationships','School','Family','Work','Mental Health','Random','Secrets'];

function SkeletonCard() {
  return (
    <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-5 mb-3">
      <div className="flex gap-2 mb-3">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-6 w-16" />
      </div>
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-5/6 mb-2" />
      <div className="skeleton h-4 w-3/4 mb-4" />
      <div className="flex gap-2">
        <div className="skeleton h-8 w-14" />
        <div className="skeleton h-8 w-14" />
        <div className="skeleton h-8 w-14" />
        <div className="skeleton h-8 w-14" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter]       = useState('All');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [newCount, setNewCount]   = useState(0);

  const loadPosts = useCallback(async (reset = false) => {
    const currentPage = reset ? 1 : page;
    if (reset) { setLoading(true); setPosts([]); }
    else setLoadingMore(true);
    try {
      const params = { page: currentPage, limit: 20, sort: 'latest' };
      if (filter !== 'All') params.category = filter;
      if (search) params.search = search;
      const { data } = await postsAPI.getAll(params);
      setPosts(prev => reset ? data.posts : [...prev, ...data.posts]);
      setHasMore(currentPage < data.pagination.pages);
      if (!reset) setPage(p => p + 1);
    } catch { toast.error('Failed to load posts'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [filter, search, page]);

  // Initial load + re-load on filter/search change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPosts(true);
  }, [filter, search]);

  // Socket.io — real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewPost = (post) => {
      setPosts(prev => {
        // Don't add duplicates
        if (prev.find(p => p.id === post.id)) return prev;
        setNewCount(c => c + 1);
        return [{ ...post, _new: true }, ...prev];
      });
    };
    const onPostUpdated = (update) => {
      setPosts(prev => prev.map(p => p.id === update.id ? { ...p, ...update } : p));
    };
    const onPostDeleted = ({ id }) => {
      setPosts(prev => prev.filter(p => p.id !== id));
    };
    const onPostHidden = ({ id }) => {
      setPosts(prev => prev.filter(p => p.id !== id));
    };

    socket.on('post:new',     onNewPost);
    socket.on('post:updated', onPostUpdated);
    socket.on('post:deleted', onPostDeleted);
    socket.on('post:hidden',  onPostHidden);
    return () => {
      socket.off('post:new',     onNewPost);
      socket.off('post:updated', onPostUpdated);
      socket.off('post:deleted', onPostDeleted);
      socket.off('post:hidden',  onPostHidden);
    };
  }, []);

  const handleUpdate = (updated) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
  };
  const handleDelete = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="font-serif text-3xl text-white tracking-tight">
          The <span className="text-[#c084fc]">Wall</span>
        </h1>
        <div className="relative flex-1 max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5868]" />
          <input
            type="text"
            placeholder="Search confessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-[#5a5868] outline-none focus:border-[#7c3aed] transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5868] hover:text-white">
              <i className="ti ti-x text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* New post notification */}
      {newCount > 0 && (
        <button
          onClick={() => { setNewCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-full mb-4 bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-xl py-2.5 text-sm text-[#c084fc] hover:bg-[#7c3aed]/20 transition flex items-center justify-center gap-2"
        >
          <i className="ti ti-arrow-up text-sm" />
          {newCount} new confession{newCount > 1 ? 's' : ''} — tap to see
        </button>
      )}

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition flex-shrink-0
              ${filter === c
                ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                : 'bg-transparent border-[#2a2a32] text-[#9896a8] hover:border-[#3a3a45] hover:text-white'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-[#5a5868]">
          <i className="ti ti-ghost text-5xl block mb-3 opacity-40" />
          <p className="text-sm">
            {search ? 'No confessions match your search' : 'No confessions yet. Be the first!'}
          </p>
        </div>
      ) : (
        <>
          {posts.map(p => (
            <PostCard key={p.id} post={p} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
          {hasMore && (
            <button
              onClick={() => loadPosts(false)}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-[#5a5868] hover:text-[#9896a8] transition flex items-center justify-center gap-2"
            >
              {loadingMore
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading…</>
                : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
