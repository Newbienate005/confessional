// src/pages/SearchPage.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { postsAPI } from '../utils/api';
import PostCard from '../components/PostCard';
import toast from 'react-hot-toast';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery]   = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query) doSearch(query);
  }, []);

  const doSearch = async (q) => {
    setSearchParams({ q });
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await postsAPI.getAll({ search: q, limit: 30 });
      setResults(data.posts);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (query.trim()) doSearch(query); };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl text-white tracking-tight mb-5">
        <span className="text-[#c084fc]">Search</span>
      </h1>
      <form onSubmit={handleSubmit} className="relative mb-6">
        <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5868]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by keyword or category…"
          className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-xl pl-10 pr-28 py-3 text-sm text-white placeholder-[#5a5868] outline-none focus:border-[#7c3aed] transition"
          autoFocus
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#7c3aed] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition">
          Search
        </button>
      </form>
      {loading ? (
        Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl mb-3" />)
      ) : !searched ? (
        <div className="text-center py-16 text-[#5a5868]">
          <i className="ti ti-search text-5xl block mb-3 opacity-40" />
          <p className="text-sm">Type something to search confessions</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 text-[#5a5868]">
          <i className="ti ti-mood-empty text-5xl block mb-3 opacity-40" />
          <p className="text-sm">No confessions match "<strong>{query}</strong>"</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#5a5868] mb-4">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</p>
          {results.map(p => <PostCard key={p.id} post={p} />)}
        </>
      )}
    </div>
  );
}
