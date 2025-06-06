const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Secret Key untuk JWT, GANTI DENGAN YANG LEBIH AMAN DI PRODUKSI
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

exports.authenticateLecturer = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (token == null) {
    logger.warn('Authentication failed: No token provided');
    return res.status(401).json({ message: 'Authentication failed: No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`Authentication failed: Invalid token - ${err.message}`);
      return res.status(403).json({ message: 'Authentication failed: Invalid token.' });
    }
    // user payload should contain lecturer_id and nidn/email
    req.lecturer = user; // Store lecturer info in request
    next();
  });
};