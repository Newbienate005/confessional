// src/pages/BookmarksPage.jsx
import { useState, useEffect } from 'react';
import { usersAPI } from '../utils/api';
import PostCard from '../components/PostCard';
import toast from 'react-hot-toast';

export default function BookmarksPage() {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersAPI.myBookmarks()
      .then(({ data }) => setPosts(data.posts))
      .catch(() => toast.error('Failed to load bookmarks'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = (updated) => setPosts(prev =>
    updated.isBookmarked ? prev.map(p => p.id === updated.id ? { ...p, ...updated } : p) : prev.filter(p => p.id !== updated.id)
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl text-white tracking-tight mb-5">
        <span className="text-[#c084fc]">Bookmarks</span>
      </h1>
      {loading
        ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl mb-3" />)
        : posts.length === 0
          ? <div className="text-center py-16 text-[#5a5868]"><i className="ti ti-bookmark text-5xl block mb-3 opacity-40" /><p className="text-sm">No bookmarks yet. Save posts to revisit them.</p></div>
          : posts.map(p => <PostCard key={p.id} post={p} onUpdate={handleUpdate} />)
      }
    </div>
  );
}
