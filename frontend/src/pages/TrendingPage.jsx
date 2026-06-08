// src/pages/TrendingPage.jsx
import { useState, useEffect } from 'react';
import { postsAPI } from '../utils/api';
import PostCard from '../components/PostCard';
import toast from 'react-hot-toast';

export default function TrendingPage() {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    postsAPI.getAll({ sort: 'trending', limit: 20 })
      .then(({ data }) => setPosts(data.posts))
      .catch(() => toast.error('Failed to load trending'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-3xl text-white tracking-tight">
          <span className="text-[#c084fc]">Trending</span> Now
        </h1>
        <p className="text-xs text-[#5a5868] mt-1">Score = reactions + comments×2, decayed by time</p>
      </div>
      {loading
        ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl mb-3" />)
        : posts.map((p, i) => <PostCard key={p.id} post={p} rank={i + 1} />)
      }
    </div>
  );
}
