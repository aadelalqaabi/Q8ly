const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory user cache — avoids a DB round-trip on every authenticated request.
// TTL: 60 s. Max size: 2 000 entries (LRU-lite: evict oldest on overflow).
const USER_CACHE = new Map();
const CACHE_TTL = 60 * 1000;

function getCached(id) {
  const entry = USER_CACHE.get(id);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { USER_CACHE.delete(id); return null; }
  return entry.user;
}

function setCache(id, user) {
  if (USER_CACHE.size >= 2000) USER_CACHE.delete(USER_CACHE.keys().next().value);
  USER_CACHE.set(id, { user, ts: Date.now() });
}

// Call this whenever a user's ban/active status changes so the stale entry is evicted immediately.
const invalidateUserCache = (userId) => USER_CACHE.delete(userId.toString());

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = decoded.id;

    let user = getCached(cacheKey);
    if (!user) {
      user = await User.findById(decoded.id).select('-password -passwordResetToken -emailVerificationToken');
      if (user) setCache(cacheKey, user);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    if (user.isBanned) {
      const banMsg = user.banExpires && user.banExpires > Date.now()
        ? `Account is banned until ${user.banExpires.toLocaleDateString()}`
        : 'Account is permanently banned';
      return res.status(403).json({ success: false, message: banMsg });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    next(error);
  }
};

// Optional auth - attach user if token present, but don't block if not
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const cacheKey = decoded.id;
      let user = getCached(cacheKey);
      if (!user) {
        user = await User.findById(decoded.id).select('-password');
        if (user) setCache(cacheKey, user);
      }
      if (user && user.isActive && !user.isBanned) {
        req.user = user;
      }
    }
    next();
  } catch {
    next();
  }
};

// Admin check (basic: can be extended with roles)
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.accountType !== 'official') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '365d',
  });
};

module.exports = { protect, optionalAuth, adminOnly, generateToken, invalidateUserCache };
