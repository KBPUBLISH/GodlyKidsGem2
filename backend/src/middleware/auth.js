const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
// Allowlist lives in config/adminEmails.js so the routes that guard privileged
// accounts share one implementation; re-exported below for existing importers.
const { isAdminEmail } = require('../config/adminEmails');

/**
 * Roles that identify a token as belonging to another portal's session.
 * Creator, church and admin tokens are all signed with the same secret (see
 * config/jwt.js), so the claims are the only thing that tells them apart.
 */
const NON_PORTAL_ADMIN_ROLES = ['creator', 'church'];

/**
 * Resolves the User id an admin/app-user token points at, or null for tokens
 * that carry no user id. Returning null must be treated as "not an admin
 * token": Mongoose casts findById(undefined) to a filter that matches nothing,
 * so relying on the lookup to fail is an accident rather than a check.
 */
const getUserIdClaim = (decoded) => decoded?.user?.id || decoded?.id || null;

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

    const decoded = jwt.verify(token, getJwtSecret());

    // 403 rather than 401 for these: the token is valid, it just is not an
    // admin session, and the portal logs the user out on 401.
    if (NON_PORTAL_ADMIN_ROLES.includes(decoded.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = getUserIdClaim(decoded);
    if (!userId) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user from database
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Checked against the account rather than the token's isAdmin claim, so
    // removing an email from the allowlist takes effect without waiting for
    // already-issued tokens to expire.
    if (!isAdminEmail(user.email)) {
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

    const decoded = jwt.verify(token, getJwtSecret());

    if (NON_PORTAL_ADMIN_ROLES.includes(decoded.role)) {
      return res.status(403).json({ error: 'Not an app user token' });
    }

    const userId = getUserIdClaim(decoded);
    if (!userId) {
      return res.status(403).json({ error: 'Not an app user token' });
    }

    const user = await User.findById(userId);
    
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

/**
 * Attach req.user when a valid app JWT is present. Missing or invalid tokens
 * continue as a guest — hub follow/reviews still work via deviceId/email.
 */
const optionalAuthenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return next();

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (!token) return next();

    const decoded = jwt.verify(token, getJwtSecret());
    if (NON_PORTAL_ADMIN_ROLES.includes(decoded.role)) return next();

    const userId = getUserIdClaim(decoded);
    if (!userId) return next();

    const user = await User.findById(userId);
    if (user) req.user = user;
  } catch {
    // Guest path
  }
  next();
};

module.exports = { authenticateAdmin, authenticateUser, optionalAuthenticateUser, isAdminEmail };
