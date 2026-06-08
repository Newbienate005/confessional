// src/pages/AdminPage.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../utils/api';
import toast from 'react-hot-toast';

function StatCard({ num, label, color = 'text-[#c084fc]' }) {
  return (
    <div className="bg-[#141417] border border-[#2a2a32] rounded-xl p-4 text-center">
      <div className={`font-serif text-3xl ${color}`}>{num ?? '…'}</div>
      <div className="text-[11px] text-[#5a5868] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab]       = useState('overview');
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'overview' || tab === 'reports') {
        const [statsRes, reportsRes] = await Promise.all([adminAPI.stats(), adminAPI.reports()]);
        setStats(statsRes.data.stats);
        setReports(reportsRes.data.reports);
      }
      if (tab === 'users') {
        const [statsRes, usersRes] = await Promise.all([adminAPI.stats(), adminAPI.users()]);
        setStats(statsRes.data.stats);
        setUsers(usersRes.data.users);
      }
    } catch { toast.error('Failed to load admin data'); }
    finally { setLoading(false); }
  }

  const banUser = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'banned' : 'active';
    try {
      await adminAPI.banUser(id, newStatus);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      toast.success(`User ${newStatus === 'banned' ? 'banned' : 'unbanned'}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const reviewReport = async (id, action) => {
    try {
      await adminAPI.reviewReport(id, { status: action, hidePost: action === 'actioned' });
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success(action === 'actioned' ? 'Post hidden' : 'Report dismissed');
    } catch { toast.error('Failed'); }
  };

  const TABS = ['overview','users','reports'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl text-white tracking-tight mb-5">
        <span className="text-[#c084fc]">Admin</span> Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard num={stats?.totalUsers}     label="Users" />
        <StatCard num={stats?.totalPosts}     label="Posts" />
        <StatCard num={stats?.pendingReports} label="Reports" color="text-amber-400" />
        <StatCard num={stats?.bannedUsers}    label="Banned"  color="text-red-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition border
              ${tab === t ? 'bg-[#7c3aed] border-[#7c3aed] text-white' : 'bg-transparent border-[#2a2a32] text-[#9896a8] hover:text-white'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl mb-2" />)
      ) : tab === 'users' ? (
        <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a32]">
                {['Username','Email','Role','Status','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] text-[#5a5868] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[#2a2a32] last:border-0 hover:bg-[#1c1c21] transition">
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3 text-[#5a5868] text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-[#9896a8]">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium
                      ${u.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => banUser(u.id, u.status)}
                      className={`text-xs px-3 py-1 rounded-lg border transition
                        ${u.status === 'active' ? 'text-red-400 border-red-500/20 hover:bg-red-500/10' : 'text-green-400 border-green-500/20 hover:bg-green-500/10'}`}
                    >
                      {u.status === 'active' ? 'Ban' : 'Unban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'reports' ? (
        reports.length === 0 ? (
          <div className="text-center py-12 text-[#5a5868]">
            <i className="ti ti-shield-check text-4xl block mb-3 opacity-40" />
            <p className="text-sm">No pending reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="bg-[#141417] border border-[#2a2a32] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs text-amber-400 font-medium">{r.reason}</span>
                    <span className="text-xs text-[#5a5868] ml-2">reported by {r.reporter_username}</span>
                  </div>
                  <span className="text-xs text-[#5a5868] flex-shrink-0">{r.category}</span>
                </div>
                <p className="text-sm text-[#9896a8] mb-3 line-clamp-2">{r.post_content}</p>
                <div className="flex gap-2">
                  <button onClick={() => reviewReport(r.id, 'actioned')} className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition">
                    Hide Post
                  </button>
                  <button onClick={() => reviewReport(r.id, 'dismissed')} className="px-3 py-1.5 bg-[#1c1c21] text-[#9896a8] border border-[#2a2a32] rounded-lg text-xs hover:text-white transition">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Overview
        <div className="bg-[#141417] border border-[#2a2a32] rounded-xl p-4 text-sm text-[#9896a8]">
          <p>Welcome, Admin. Use the tabs above to manage users and review reports.</p>
          <p className="mt-2 text-[#5a5868] text-xs">Real-time moderation is active — reported posts are auto-hidden after 5 reports.</p>
        </div>
      )}
    </div>
  );
}
