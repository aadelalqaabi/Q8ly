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

// Railway (and most PaaS) sit behind a reverse proxy — trust the first hop
app.set('trust proxy', 1);

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

// Public web pages (privacy policy, support)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  contentSecurityPolicy: false, // API server — CSP set per-route above
}));
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.CLIENT_URL, process.env.FRONTEND_URL, 'https://kuwai.app', 'https://www.kuwai.app'].filter(Boolean)
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

// Contact form — sends email to info@kuwai.app
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many submissions, try again later.' });
app.post('/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }
  try {
    const nodemailer = require('nodemailer');
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
      console.error('[Contact form] EMAIL_USER or EMAIL_PASS env var is not set');
      return res.status(500).json({ success: false, message: 'Mail service not configured.' });
    }
    const port = parseInt(process.env.EMAIL_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.zoho.com',
      port,
      secure: port === 465,
      auth: { user: emailUser, pass: emailPass },
    });
    await transporter.sendMail({
      from: `"KUWAI" <${emailUser}>`,
      to: emailUser,
      replyTo: `"${name}" <${email}>`,
      subject: `[Support] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html: `<p><b>Name:</b> ${name}</p><p><b>Email:</b> <a href="mailto:${email}">${email}</a></p><p><b>Subject:</b> ${subject}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p>`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[Contact form] email error:', err.code, err.message);
    res.status(500).json({ success: false, message: 'Could not send message.' });
  }
});

// Smart redirect — open in app or fall back to App Store
const appRedirectHTML = (deepLink, title = 'KUWAI') => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="apple-itunes-app" content="app-id=6760574615, app-argument=${deepLink}" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .logo { font-size: 36px; font-weight: 900; color: #0033A0; letter-spacing: 6px; margin-bottom: 12px; }
    .sub { font-size: 16px; color: #6C6C70; margin-bottom: 40px; }
    .btn {
      display: inline-block;
      background: #0033A0;
      color: #fff;
      font-size: 17px;
      font-weight: 600;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 14px;
      margin-bottom: 16px;
    }
    .store { font-size: 14px; color: #6C6C70; }
    .store a { color: #0033A0; text-decoration: none; }
  </style>
</head>
<body>
  <div class="logo">KUWAI</div>
  <div class="sub">Opening in the app…</div>
  <a class="btn" href="${deepLink}">Open KUWAI</a>
  <div class="store">
    Don't have the app?
    <a href="https://apps.apple.com/us/app/kuwai/id6760574615">Download on the App Store</a>
  </div>
  <script>
    window.location = '${deepLink}';
    setTimeout(function() {
      window.location = 'https://apps.apple.com/us/app/kuwai/id6760574615';
    }, 2000);
  </script>
</body>
</html>`;

app.get('/post/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(appRedirectHTML(`kuwai://post/${req.params.id}`, 'Open in KUWAI'));
});

app.get('/profile/:username', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(appRedirectHTML(`kuwai://profile/${req.params.username}`, `@${req.params.username} on KUWAI`));
});

app.get('/circle/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(appRedirectHTML(`kuwai://circle/${req.params.id}`, 'Join Circle on KUWAI'));
});

// Universal Links — iOS (Apple App Site Association)
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: 'M8C6L4JP56.kuwai.cotan.com',
          paths: ['/profile/*', '/post/*', '/circle/*'],
        },
      ],
    },
  });
});

// App Links — Android
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.kuwaitnow',
        sha256_cert_fingerprints: [], // fill in after first Android build
      },
    },
  ]);
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
