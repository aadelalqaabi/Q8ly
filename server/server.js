require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const initSocket = require('./sockets/socketHandler');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const topicRoutes = require('./routes/topics');
const spaceRoutes = require('./routes/spaces');
const notificationRoutes = require('./routes/notifications');
const eventRoutes = require('./routes/events');
const uploadRoutes = require('./routes/upload');
const hachiRoutes = require('./routes/hachi');
const adminRoutes = require('./routes/admin');
const dmRoutes = require('./routes/dm');
const suggestionRoutes = require('./routes/suggestions');
const adRoutes = require('./routes/ads');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Initialize Socket.io
const io = initSocket(server);

// Make io accessible to routes
app.set('io', io);

// Admin panel — serve static files with tightened CSP
app.use('/admin', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https:; script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;"
  );
  next();
}, express.static(path.join(__dirname, 'public/admin')));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  contentSecurityPolicy: false, // API server — CSP set per-route above
}));
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.CLIENT_URL, process.env.FRONTEND_URL].filter(Boolean)
  : [process.env.CLIENT_URL, process.env.FRONTEND_URL, 'http://localhost:19000', 'http://localhost:3000', /^exp:\/\//];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return cb(null, true);
    const allowed = allowedOrigins.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter limiter for auth (10 attempts per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Strict limiter for admin login (5 attempts per 15 min)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many admin login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin/login', adminLoginLimiter);

// Body parsing — keep low for regular API, uploads use multer limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/hachi', hachiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/ads', adRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = { app, server };
