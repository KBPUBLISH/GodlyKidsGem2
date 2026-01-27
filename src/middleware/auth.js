const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Get admin emails from environment variable
 * Set ADMIN_EMAILS as comma-separated list: "admin@example.com,support@example.com"
 */
const getAdminEmails = () => {
  const envEmails = process.env.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(e => e.trim().toLowerCase());
  }
  // Fallback default admin emails
  return [
    'admin@godlykids.com',
    'support@godlykids.com',
    'hello@kbpublish.org',
  ];
};

/**
 * Middleware to authenticate admin users
 * Checks for (in order):
 * 1. Admin API key in X-Admin-Key header (if ADMIN_API_KEY env var is set)
 * 2. JWT token with admin email
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Option 1: Check for admin API key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey && process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY) {
      return next();
    }

    // Option 2: Check for JWT token with admin email
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization provided' });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Get user from database
    const user = await User.findById(decoded.user?.id || decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user email is in admin list
    const adminEmails = getAdminEmails();
    if (!adminEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to authenticate regular users
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization provided' });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const user = await User.findById(decoded.user?.id || decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateAdmin, authenticateUser };
