/**
 * Who is calling a hub/token route.
 *
 * Prefer the authenticated User email from a JWT so the client cannot pick
 * a fake id. Fall back to the same deviceId / email keys the rest of the
 * kids app already uses for AppUser (tokens, progress).
 */
function identityFromRequest(req) {
    const authEmail = typeof req.user?.email === 'string'
        ? req.user.email.toLowerCase().trim()
        : '';
    const body = req.body || {};
    const query = req.query || {};
    const clientEmail = String(body.userEmail || body.email || query.email || '')
        .toLowerCase()
        .trim();
    const clientUserId = String(body.userId || query.userId || '').trim();

    const userEmail = authEmail || clientEmail || undefined;
    const userId = userEmail || clientUserId || undefined;
    const fromAuth = Boolean(authEmail);

    return { userId, userEmail, fromAuth };
}

module.exports = { identityFromRequest };
