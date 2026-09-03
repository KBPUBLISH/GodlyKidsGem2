/**
 * Single source of truth for JWT signing / verification config.
 *
 * There is deliberately NO fallback secret: a hard-coded default would let
 * anyone mint valid user, admin, creator or church tokens against a deploy that
 * forgot to set JWT_SECRET.
 */

const MISSING_SECRET_MESSAGE =
  'JWT_SECRET is not set. Generate one with `openssl rand -hex 32` and set it in ' +
  'your environment (local .env file) / Render dashboard before starting the server.';

// Token lifetimes, previously duplicated across the auth routes
const JWT_EXPIRY = {
  access: '1h',        // /api/authentication access tokens
  refresh: '7d',       // /api/authentication refresh tokens
  legacy: 360000,      // /api/auth tokens (seconds) - kept for older app builds
  session: '30d',      // creator + church portal logins
};

/**
 * Returns the JWT secret, or throws if it is missing/blank.
 * Called at signing/verification time so simply requiring a route file does not
 * throw (keeps unrelated scripts that import routes working).
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(MISSING_SECRET_MESSAGE);
  }
  return secret;
};

/**
 * Startup guard - imported by src/index.js so a misconfigured deploy fails
 * immediately instead of on the first login request.
 */
const assertJwtSecret = () => {
  getJwtSecret();
};

module.exports = { getJwtSecret, assertJwtSecret, JWT_EXPIRY, MISSING_SECRET_MESSAGE };
