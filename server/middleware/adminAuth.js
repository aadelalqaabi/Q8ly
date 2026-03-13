const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin token required' });
    }

    // Use a dedicated admin secret if set — prevents user tokens from being accepted
    const secret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: 'Not an admin token' });
    }

    // Always verify against DB — never trust payload alone
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(403).json({ success: false, message: 'Admin not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = adminAuth;
