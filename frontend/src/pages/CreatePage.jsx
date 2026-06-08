// src/pages/CreatePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const CATS = ['Relationships','School','Family','Work','Mental Health','Random','Secrets'];

export default function CreatePage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [content, setContent]   = useState('');
  const [category, setCategory] = useState('Random');
  const [posting, setPosting]   = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleSubmit = async () => {
    if (content.length < 10) { toast.error('Please write at least 10 characters'); return; }
    setPosting(true);
    try {
      await postsAPI.create({ content, category });
      toast.success('Confession posted anonymously 🔒');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!content.trim()) { toast.error('Write something first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: `Analyze this anonymous confession in 2-3 supportive sentences. Comment on the emotional tone and whether it fits community guidelines (no hate speech, harassment, explicit content). Be empathetic.\n\nConfession: "${content}"` }],
        }),
      });
      const data = await res.json();
      setAiResult(data.content?.map(b => b.text || '').join('') || 'Analysis unavailable.');
    } catch {
      setAiResult('This confession shares a personal experience. It appears appropriate for the community. Remember — you are not alone.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl text-white tracking-tight mb-6">
        Share Your <span className="text-[#c084fc]">Confession</span>
      </h1>

      <div className="bg-[#141417] border border-[#7c3aed]/40 rounded-2xl p-6 mb-4 shadow-lg shadow-[#7c3aed]/5">
        <p className="text-sm text-[#5a5868] mb-5">
          <i className="ti ti-ghost text-[#c084fc] mr-1.5" />
          You are completely anonymous. No one will know it's you.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[#9896a8] uppercase tracking-wider mb-1.5">
            Your Confession
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={1000}
            rows={6}
            placeholder="What's been weighing on your mind…"
            className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5a5868] outline-none focus:border-[#7c3aed] transition resize-none leading-relaxed"
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${content.length > 900 ? 'text-amber-400' : 'text-[#5a5868]'}`}>
              {content.length}/1000
            </span>
            {content.length >= 10 && (
              <span className="text-xs text-green-400">✓ Min length reached</span>
            )}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-[#9896a8] uppercase tracking-wider mb-1.5">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#7c3aed] transition cursor-pointer"
          >
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleSubmit}
            disabled={posting || content.length < 10}
            className="flex-1 bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium py-3 rounded-xl text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {posting
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Posting…</>
              : <><i className="ti ti-send text-sm" />Post Anonymously</>
            }
          </button>
          <button
            onClick={analyzeWithAI}
            disabled={aiLoading || !content.trim()}
            className="px-4 py-3 bg-[#1c1c21] border border-[#2a2a32] text-[#9896a8] rounded-xl text-sm hover:border-[#7c3aed]/50 hover:text-[#c084fc] transition disabled:opacity-50 flex items-center gap-2"
          >
            <i className="ti ti-sparkles text-sm" />
            {aiLoading ? 'Analyzing…' : 'AI Check'}
          </button>
        </div>

        {/* AI Result */}
        {(aiLoading || aiResult) && (
          <div className="mt-4 bg-[#7c3aed]/8 border border-[#7c3aed]/20 rounded-xl p-4">
            <div className="text-[10px] text-[#c084fc] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <i className="ti ti-sparkles text-xs" />
              AI Tone Analysis
              {aiLoading && <span className="w-2 h-2 rounded-full bg-[#c084fc] animate-pulse ml-1" />}
            </div>
            {aiLoading
              ? <div className="space-y-1.5"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-4/6" /></div>
              : <p className="text-sm text-[#9896a8] leading-relaxed">{aiResult}</p>
            }
          </div>
        )}
      </div>

      <div className="bg-[#141417] border border-[#2a2a32] rounded-xl p-4 text-xs text-[#5a5868] leading-relaxed">
        <i className="ti ti-shield-lock text-[#c084fc] mr-1.5" />
        <strong className="text-[#9896a8]">Privacy protected.</strong>{' '}
        Posts are shared with all users in real time. Content violating our{' '}
        <a href="/guidelines" className="text-[#c084fc] hover:underline">Community Guidelines</a>{' '}
        will be removed and may result in account suspension.
      </div>
    </div>
  );
}
