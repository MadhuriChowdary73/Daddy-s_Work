const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'pdf-library-super-secret-jwt-key-2024';

function authMiddleware(req, res, next) {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Or check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized: Admin account no longer exists' });
    }
    req.user = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

module.exports = {
  authMiddleware,
  JWT_SECRET
};

