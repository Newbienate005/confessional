// src/server.js
require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server: SocketServer } = require('socket.io');
const helmet  = require('helmet');
const cors    = require('cors');
const { verifyAccessToken } = require('./utils/jwt');
const { apiLimiter, sanitizeInput, errorHandler } = require('./middleware/security');
const { pool } = require('./config/database');

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET','POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.slice(7);
  if (!token) { socket.user = null; return next(); }
  try {
    socket.user = verifyAccessToken(token);
    next();
  } catch {
    socket.user = null;
    next();
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.id;
  if (userId) {
    socket.join(`user:${userId}`);
    console.log(`User ${socket.user.username} connected (${socket.id})`);
  } else {
    console.log(`Anonymous visitor connected (${socket.id})`);
  }

  // Join a post room for live comments
  socket.on('post:join', (postId) => {
    socket.join(`post:${postId}`);
  });

  socket.on('post:leave', (postId) => {
    socket.leave(`post:${postId}`);
  });

  socket.on('disconnect', () => {
    if (userId) console.log(`User ${socket.user?.username} disconnected`);
  });
});

app.set('io', io);

// ── Security middleware ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeInput);
app.use(apiLimiter);

// ── Request logging (dev) ─────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use((req, _, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
const { adminRouter, userRouter } = require('./routes/admin');
app.use('/api/admin', adminRouter);
app.use('/api/users', userRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, status: 'database unavailable' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Confessional server running on port ${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down...');
  server.close(() => { pool.end(); process.exit(0); });
});
process.on('SIGINT', async () => {
  console.log('SIGINT received — shutting down...');
  server.close(() => { pool.end(); process.exit(0); });
});

module.exports = { app, io };
