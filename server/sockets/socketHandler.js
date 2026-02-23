const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL,
        process.env.FRONTEND_URL,
        'http://localhost:19000',
        'http://localhost:3000',
        /^exp:\/\//,
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        // Allow unauthenticated connections for public rooms
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username name profilePic');

      if (!user) {
        socket.user = null;
        return next();
      }

      socket.user = user;
      next();
    } catch (error) {
      // Token error – allow as unauthenticated
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id;

    if (userId) {
      // Join personal room for directed notifications
      socket.join(`user:${userId}`);
      console.log(`User ${socket.user.username} connected (socket: ${socket.id})`);
    }

    // ── Space rooms ──────────────────────────────────────────────
    socket.on('joinSpace', (spaceId) => {
      socket.join(`space:${spaceId}`);
    });

    socket.on('leaveSpace', (spaceId) => {
      socket.leave(`space:${spaceId}`);
    });

    // ── Post rooms (for live comments) ───────────────────────────
    socket.on('joinPost', (postId) => {
      socket.join(`post:${postId}`);
    });

    socket.on('leavePost', (postId) => {
      socket.leave(`post:${postId}`);
    });

    // ── Typing indicators ─────────────────────────────────────────
    socket.on('typing', ({ postId, isTyping }) => {
      if (!socket.user) return;
      socket.to(`post:${postId}`).emit('typing', {
        postId,
        user: { username: socket.user.username, name: socket.user.name },
        isTyping,
      });
    });

    // ── Now Bar: live situation updates (admin broadcast) ─────────
    socket.on('broadcastNowBar', (data) => {
      // In production: verify this socket is from an admin user
      io.emit('nowBarUpdate', data);
    });

    // ── Disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (userId) {
        console.log(`User ${socket.user?.username} disconnected`);
      }
    });

    // ── Error handling ────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err.message);
    });
  });

  return io;
};

module.exports = initSocket;
