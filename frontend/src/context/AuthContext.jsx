// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while checking stored token

  // Restore session on mount
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { setLoading(false); return; }
    authAPI.me()
      .then(({ data }) => {
        setUser(data.user);
        connectSocket(accessToken);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for forced logout (token refresh failed)
  useEffect(() => {
    const handler = () => logout(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const saveTokens = (accessToken, refreshToken, userData) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    connectSocket(accessToken);
  };

  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData);
    saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const { data } = await authAPI.login({ identifier, password });
    saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const { data } = await authAPI.google(idToken);
    saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }, []);

  const logout = useCallback(async (callApi = true) => {
    if (callApi) {
      const refreshToken = localStorage.getItem('refreshToken');
      authAPI.logout(refreshToken).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    disconnectSocket();
  }, []);

  const value = { user, loading, register, login, googleLogin, logout, setUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
