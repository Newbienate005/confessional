// src/pages/AuthPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';

// ── Shared components ─────────────────────────────────────

function AuthCard({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl text-white tracking-tight">Confessional</h1>
          <p className="text-[#5a5868] text-sm mt-2">{subtitle}</p>
        </div>
        <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-8">
          {title && <h2 className="text-xl font-semibold text-white mb-6">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
}

function FormInput({ label, error, hint, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-medium text-[#9896a8] uppercase tracking-wider mb-1.5">{label}</label>}
      <input
        className={`w-full bg-[#1c1c21] border rounded-lg px-4 py-3 text-sm text-white placeholder-[#5a5868] outline-none transition focus:border-[#7c3aed] ${error ? 'border-red-500' : 'border-[#2a2a32]'}`}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      {hint && <p className="text-[#5a5868] text-xs mt-1">{hint}</p>}
    </div>
  );
}

function PasswordInput({ label, value, onChange, error, placeholder = '••••••••', name }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-medium text-[#9896a8] uppercase tracking-wider mb-1.5">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-[#1c1c21] border rounded-lg px-4 py-3 pr-11 text-sm text-white placeholder-[#5a5868] outline-none transition focus:border-[#7c3aed] ${error ? 'border-red-500' : 'border-[#2a2a32]'}`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5868] hover:text-[#9896a8] transition p-1"
          title={show ? 'Hide password' : 'Show password'}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm py-2.5 px-4 rounded-lg border border-gray-200 transition disabled:opacity-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? 'Signing in...' : 'Continue with Google'}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[#2a2a32]" />
      <span className="text-[#5a5868] text-xs">or</span>
      <div className="flex-1 h-px bg-[#2a2a32]" />
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────
export function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const errs = {};
    if (!form.identifier) errs.identifier = 'Required';
    if (!form.password)   errs.password   = 'Required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await login(form.identifier, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      toast.error(msg);
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        // Exchange access token for ID token via userinfo
        const { data: userInfo } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        await googleLogin(tokenResponse.access_token);
        toast.success('Signed in with Google!');
        navigate('/');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Google sign-in failed');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error('Google sign-in was cancelled'),
  });

  return (
    <AuthCard subtitle="Your secrets, safely held. Anonymously.">
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />
      <Divider />
      <form onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">{errors.general}</div>
        )}
        <FormInput
          label="Username or Email"
          type="text"
          placeholder="Enter username or email..."
          value={form.identifier}
          onChange={set('identifier')}
          error={errors.identifier}
          autoComplete="username"
          autoFocus
        />
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          name="password"
        />
        <div className="flex justify-end mb-4 -mt-2">
          <Link to="/forgot-password" className="text-xs text-[#5a5868] hover:text-[#c084fc] transition">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="text-center text-[#5a5868] text-sm mt-5">
        No account?{' '}
        <Link to="/register" className="text-[#c084fc] hover:underline">Create one free</Link>
      </p>
    </AuthCard>
  );
}

// ── REGISTER PAGE ─────────────────────────────────────────
export function RegisterPage() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', acceptedTerms: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.username || form.username.length < 3) errs.username = 'Min 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errs.username = 'Letters, numbers, underscores only';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Valid email required';
    if (!form.password || form.password.length < 8) errs.password = 'Min 8 characters';
    if (!/[A-Z]/.test(form.password)) errs.password = 'Needs an uppercase letter';
    if (!/[0-9]/.test(form.password)) errs.password = 'Needs a number';
    if (!form.acceptedTerms) errs.terms = 'You must accept the Terms & Conditions';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register({ ...form, acceptedTerms: 'true' });
      toast.success("Account created! Check your email to verify.");
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      toast.error(msg);
      // Map validation details
      const details = err.response?.data?.details || [];
      const fieldErrors = {};
      details.forEach(d => { fieldErrors[d.field] = d.message; });
      setErrors({ ...fieldErrors, general: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!form.acceptedTerms) { toast.error('Please accept the Terms & Conditions first'); return; }
      setGoogleLoading(true);
      try {
        await googleLogin(tokenResponse.access_token);
        toast.success('Account created with Google!');
        navigate('/');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Google sign-in failed');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error('Google sign-in was cancelled'),
  });

  return (
    <AuthCard subtitle="Join anonymously. No judgment here.">
      {errors.general && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">{errors.general}</div>
      )}

      {/* T&C must be shown before Google */}
      <div className="bg-[#1c1c21] border border-[#2a2a32] rounded-lg p-4 mb-4 text-xs text-[#5a5868] leading-relaxed">
        <p className="mb-2 font-medium text-[#9896a8]">Before you join:</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={e => setForm(f => ({ ...f, acceptedTerms: e.target.checked }))}
            className="mt-0.5 accent-[#7c3aed] w-4 h-4 flex-shrink-0"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-[#c084fc] hover:underline">Terms & Conditions</Link>
            ,{' '}
            <Link to="/privacy" target="_blank" className="text-[#c084fc] hover:underline">Privacy Policy</Link>
            , and{' '}
            <Link to="/guidelines" target="_blank" className="text-[#c084fc] hover:underline">Community Guidelines</Link>
            . I confirm I am 13 years of age or older.
          </span>
        </label>
        {errors.terms && <p className="text-red-400 mt-2">{errors.terms}</p>}
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />
      <Divider />

      <form onSubmit={handleSubmit} noValidate>
        <FormInput label="Username" type="text" placeholder="Choose a username..." value={form.username} onChange={set('username')} error={errors.username} autoFocus />
        <FormInput label="Email Address" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          name="new-password"
        />
        <p className="text-[#5a5868] text-xs mb-4 -mt-2">Min 8 chars · 1 uppercase · 1 number</p>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="text-center text-[#5a5868] text-sm mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-[#c084fc] hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}

// ── FORGOT PASSWORD PAGE ──────────────────────────────────
export function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword(email);
      setSent(true);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard subtitle="We'll send you a reset link">
      {sent ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Check your inbox</h3>
          <p className="text-[#5a5868] text-sm mb-6">If an account exists for <strong className="text-[#9896a8]">{email}</strong>, a reset link has been sent. Check your spam folder too.</p>
          <Link to="/login" className="text-[#c084fc] text-sm hover:underline">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="text-[#9896a8] text-sm mb-5">Enter your email address and we'll send you a link to reset your password.</p>
          <FormInput
            label="Email Address"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner /> : null}
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          <div className="text-center mt-4">
            <Link to="/login" className="text-[#5a5868] text-sm hover:text-[#c084fc] transition">← Back to sign in</Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

// ── RESET PASSWORD PAGE ───────────────────────────────────
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (password.length < 8) errs.password = 'Min 8 characters';
    if (!/[A-Z]/.test(password)) errs.password = 'Needs uppercase letter';
    if (!/[0-9]/.test(password)) errs.password = 'Needs a number';
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword({ token, password });
      toast.success(data.message);
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
      setErrors({ general: err.response?.data?.error });
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <AuthCard subtitle="Invalid reset link">
      <p className="text-red-400 text-sm text-center">This reset link is invalid or missing. <Link to="/forgot-password" className="text-[#c084fc] hover:underline">Request a new one</Link>.</p>
    </AuthCard>
  );

  return (
    <AuthCard subtitle="Create a new password">
      <form onSubmit={handleSubmit}>
        {errors.general && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">{errors.general}</div>}
        <PasswordInput label="New Password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} name="new-password" />
        <PasswordInput label="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.confirm} name="confirm-password" placeholder="Confirm new password" />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </AuthCard>
  );
}

// ── TERMS PAGE ────────────────────────────────────────────
export function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0f] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/register" className="text-[#5a5868] text-sm hover:text-[#c084fc] flex items-center gap-2 mb-6 transition">
          ← Back
        </Link>
        <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-8">
          <h1 className="font-serif text-2xl text-white mb-2">Terms & Conditions</h1>
          <p className="text-[#5a5868] text-xs mb-6">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <div className="text-[#9896a8] text-sm leading-relaxed space-y-4">
            <section>
              <h2 className="text-white font-semibold mb-2">1. Acceptance</h2>
              <p>By accessing Confessional, you agree to these Terms. If you disagree, do not use the platform.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">2. Age Requirement</h2>
              <p>You must be at least 13 years old. By registering, you confirm this.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">3. Anonymous Use</h2>
              <p>Posts appear anonymous publicly. We maintain internal records for safety. True anonymity cannot be guaranteed in all legal circumstances.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">4. Prohibited Content</h2>
              <p>You may not post: hate speech, harassment, explicit sexual content, content involving minors, self-harm encouragement, spam, or illegal material.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">5. Moderation</h2>
              <p>We may remove content and ban users violating these Terms at our sole discretion.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">6. Mental Health Disclaimer</h2>
              <p>Confessional is not a substitute for professional mental health support. If in crisis, contact emergency services immediately.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">7. Privacy</h2>
              <p>Your email is used only for authentication and recovery. We do not sell personal data.</p>
            </section>
            <section>
              <h2 className="text-white font-semibold mb-2">8. Limitation of Liability</h2>
              <p>Confessional is provided "as is". We are not liable for damages arising from use of the platform.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>;
}

export { PasswordInput };
