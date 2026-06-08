// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../utils/api';
import PostCard from '../components/PostCard';
import toast from 'react-hot-toast';

function StatPill({ value, label, color = 'text-[#c084fc]' }) {
  return (
    <div className="text-center px-5">
      <div className={`font-serif text-3xl ${color}`}>{value}</div>
      <div className="text-[11px] text-[#5a5868] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [posts, setPosts]   = useState([]);
  const [stats, setStats]   = useState({ posts: 0, reactions: 0, comments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([usersAPI.myPosts(), usersAPI.myStats()])
      .then(([postsRes, statsRes]) => {
        setPosts(postsRes.data.posts);
        setStats(statsRes.data.stats);
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const anonName = (() => {
    const names = ['Ghost','Phantom','Shadow','Specter','Cipher','Wraith','Mist','Echo'];
    const h = (user?.id || '0').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return names[h % names.length] + '_' + (h % 9000 + 1000);
  })();

  const avatarContent = user?.photo_url
    ? <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
    : <span className="font-serif text-3xl text-white">{user?.username?.[0]?.toUpperCase()}</span>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Profile header */}
      <div className="bg-gradient-to-br from-[#7c3aed]/10 to-[#ec4899]/5 border border-[#2a2a32] rounded-2xl p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarContent}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl text-white font-medium">{anonName}</h2>
          <p className="text-xs text-[#5a5868] mt-0.5">Your public anonymous identity</p>
          <div className="flex gap-1 mt-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c084fc]">
              {user?.role}
            </span>
            {user?.email_verified && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                ✓ Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-5 mb-6 flex justify-around">
        <StatPill value={stats.posts}     label="Confessions" />
        <div className="w-px bg-[#2a2a32]" />
        <StatPill value={stats.reactions} label="Reactions received" />
        <div className="w-px bg-[#2a2a32]" />
        <StatPill value={stats.comments}  label="Comments" color="text-[#60a5fa]" />
      </div>

      {/* Confessions */}
      <h3 className="text-sm font-medium text-[#9896a8] mb-4">Your Confessions</h3>
      {loading
        ? Array(2).fill(0).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl mb-3" />)
        : posts.length === 0
          ? <div className="text-center py-12 text-[#5a5868]"><i className="ti ti-notes text-4xl block mb-3 opacity-40" /><p className="text-sm">You haven't confessed anything yet.</p></div>
          : posts.map(p => <PostCard key={p.id} post={{ ...p, isOwner: true }} onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))} />)
      }

      {/* Sign out */}
      <button
        onClick={() => { logout(); }}
        className="mt-6 w-full py-3 text-sm text-[#5a5868] hover:text-red-400 border border-[#2a2a32] hover:border-red-500/30 rounded-xl transition flex items-center justify-center gap-2"
      >
        <i className="ti ti-logout" />
        Sign Out
      </button>
    </div>
  );
}
