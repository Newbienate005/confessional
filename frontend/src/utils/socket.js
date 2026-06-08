// src/utils/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

let socket = null;

export function getSocket() { return socket; }

export function connectSocket(token) {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message));
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
