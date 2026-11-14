const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// Rate limiter for login: max 5 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP address. Please try again after 15 minutes.'
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const isMatch = bcrypt.compareSync(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Set httpOnly cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: admin.id,
      username: admin.username
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me (Check current auth status)
router.get('/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.user.id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, admin.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

  return res.json({ message: 'Password updated successfully' });
});

module.exports = router;

