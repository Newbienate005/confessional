// src/utils/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach token ─────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: auto-refresh token ──────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  google:   (idToken) => api.post('/auth/google', { idToken }),
  logout:   (refreshToken) => api.post('/auth/logout', { refreshToken }),
  refresh:  (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me:       () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (data)  => api.post('/auth/reset-password', data),
  verifyEmail:    (token) => api.get(`/auth/verify-email?token=${token}`),
};

// ── Posts ─────────────────────────────────────────────────
export const postsAPI = {
  getAll:    (params) => api.get('/posts', { params }),
  getOne:    (id)     => api.get(`/posts/${id}`),
  create:    (data)   => api.post('/posts', data),
  delete:    (id)     => api.delete(`/posts/${id}`),
  react:     (id, reactionType) => api.post(`/posts/${id}/react`, { reactionType }),
  comment:   (id, data)         => api.post(`/posts/${id}/comments`, data),
  deleteComment: (postId, commentId) => api.delete(`/posts/${postId}/comments/${commentId}`),
  report:    (id, data) => api.post(`/posts/${id}/report`, data),
  bookmark:  (id)       => api.post(`/posts/${id}/bookmark`),
};

// ── Users ─────────────────────────────────────────────────
export const usersAPI = {
  myPosts:     () => api.get('/users/me/posts'),
  myBookmarks: () => api.get('/users/me/bookmarks'),
  myStats:     () => api.get('/users/me/stats'),
};

// ── Admin ─────────────────────────────────────────────────
export const adminAPI = {
  stats:        () => api.get('/admin/stats'),
  users:        (params) => api.get('/admin/users', { params }),
  banUser:      (id, status) => api.patch(`/admin/users/${id}/ban`, { status }),
  reports:      (params) => api.get('/admin/reports', { params }),
  reviewReport: (id, data) => api.patch(`/admin/reports/${id}`, data),
  deletePost:   (id) => api.delete(`/admin/posts/${id}`),
  trending:     () => api.get('/admin/trending'),
};

export default api;
