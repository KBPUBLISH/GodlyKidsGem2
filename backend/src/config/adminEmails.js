/**
 * Single source of truth for which email addresses are privileged (admin portal
 * access, and protection from account deletion).
 *
 * There is deliberately NO fallback list: registration is open and requires no
 * email verification (see routes/auth.js + models/User.js), so hard-coded admin
 * addresses would hand admin to anyone who registered one of them on a deploy
 * that forgot to set ADMIN_EMAILS.
 */

const MISSING_ADMIN_EMAILS_MESSAGE =
  'ADMIN_EMAILS is not set. Set it to a comma-separated list of admin addresses ' +
  '("admin@example.com,support@example.com") in your environment (local .env file) / ' +
  'Render dashboard. Until it is set no account has admin access, so nobody can log ' +
  'into the admin portal.';

/**
 * The allowlist, lowercased and trimmed, with empty entries dropped so a stray
 * trailing comma cannot leave a '' in the list that an account with a blank
 * email would match.
 *
 * Read per call rather than cached at require time so a host that can change
 * env vars without a rebuild takes effect on restart alone, and so tests can
 * vary it.
 */
const getAdminEmails = () => {
  const envEmails = process.env.ADMIN_EMAILS;
  if (!envEmails) {
    return [];
  }
  return envEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
};

/**
 * Whether an account is an admin. Exported so the login route can stamp the
 * same answer onto the token it mints (see routes/auth.js) - the portal has no
 * other way to tell an admin from an ordinary app user at login time.
 *
 * Compared case-insensitively: local parts are technically case-sensitive, but
 * nothing here relies on that and a case-sensitive check would be a footgun the
 * first time someone capitalised the address in the Render dashboard.
 */
const isAdminEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return getAdminEmails().includes(normalized);
};

/**
 * Startup check - called by src/index.js next to assertJwtSecret() so a deploy
 * with no admins configured says so in the boot logs instead of surfacing as an
 * unexplained 403 at the portal login screen.
 *
 * Unlike assertJwtSecret() this deliberately does NOT throw. A missing secret
 * makes every request forgeable, but a missing allowlist only means no admins:
 * the kids app, creator portal and church portal are all still safe to serve,
 * and taking them down over an admin-only misconfiguration would cause more
 * harm than it prevents. The allowlist fails closed either way.
 */
const warnIfNoAdminEmails = () => {
  if (getAdminEmails().length === 0) {
    console.error(`❌ ${MISSING_ADMIN_EMAILS_MESSAGE}`);
    return false;
  }
  return true;
};

module.exports = {
  getAdminEmails,
  isAdminEmail,
  warnIfNoAdminEmails,
  MISSING_ADMIN_EMAILS_MESSAGE,
};
