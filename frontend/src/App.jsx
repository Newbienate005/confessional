// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, TermsPage } from './pages/AuthPage';
import HomePage from './pages/HomePage';
import TrendingPage from './pages/TrendingPage';
import CreatePage from './pages/CreatePage';
import SearchPage from './pages/SearchPage';
import BookmarksPage from './pages/BookmarksPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import PostModal from './components/PostModal';

// Route guard — redirects to /login if not authenticated
function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin' && user.role !== 'moderator') {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Route guard — redirects to / if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
      <div className="text-center">
        <div className="font-serif text-2xl text-white mb-4">Confessional</div>
        <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/terms"           element={<TermsPage />} />
        <Route path="/privacy"         element={<TermsPage />} />
        <Route path="/guidelines"      element={<TermsPage />} />

        {/* Protected app routes — all inside Layout */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index           element={<HomePage />} />
          <Route path="trending" element={<TrendingPage />} />
          <Route path="create"   element={<CreatePage />} />
          <Route path="search"   element={<SearchPage />} />
          <Route path="bookmarks"element={<BookmarksPage />} />
          <Route path="profile"  element={<ProfilePage />} />
          <Route path="admin"    element={<PrivateRoute adminOnly><AdminPage /></PrivateRoute>} />
          {/* Post modal rendered as child route so it overlays the feed */}
          <Route path="post/:id" element={<PostModal />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
