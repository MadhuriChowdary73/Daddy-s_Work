const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure database and initial data exist
try {
  seed();
} catch (err) {
  console.error('Error during database check/seeding:', err);
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/subsections', require('./routes/subsections'));
app.use('/api/documents', require('./routes/documents'));

// Fallback for SPA navigation
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`PDF Library Server running at: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
