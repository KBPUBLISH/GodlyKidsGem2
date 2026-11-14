const crypto = require('node:crypto');
const DAY = 86400000;
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eligible = subscriber => Boolean(subscriber && subscriber.optInUpdates === true && !subscriber.unsubscribedAt);
const STAGES = ['day0_welcome', 'day2_tips', 'day4_features', 'day6_checkin', 'day7_final'];
const DAYS = [0, 2, 4, 6, 7];
function getDripStage(createdAt, sent = {}, lastSent, now = new Date()) {
  if (lastSent && now - new Date(lastSent) < DAY) return null;
  const age = now - new Date(createdAt);
  return STAGES.find((stage, i) => age >= DAYS[i] * DAY && !sent[stage]) || null;
}
function tokenFor(email, secret) {
  if (!secret || secret.length < 32) throw new Error('EMAIL_UNSUBSCRIBE_SECRET must contain at least 32 characters');
  const payload = Buffer.from(normalizeEmail(email)).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function emailFromToken(token, secret) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const email = Buffer.from(payload, 'base64url').toString();
  if (!validEmail(email)) return null;
  const expected = tokenFor(email, secret);
  return expected.length === token.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? email : null;
}
function validateMessages(messages, appUrl) {
  if (!Array.isArray(messages) || messages.length !== 3) throw new Error('Exactly three update messages are required');
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS app URL');
  for (const message of messages) {
    for (const key of ['subject', 'body', 'cta']) {
      if (typeof message[key] !== 'string' || !message[key].trim() || message[key].length > (key === 'body' ? 10000 : 200)) throw new Error('Each message needs a subject, body, and button label');
    }
    if (/[\r\n]/.test(message.subject)) throw new Error('Subject must be a single line');
  }
}
module.exports = { DAY, STAGES, normalizeEmail, validEmail, escapeHtml, eligible, getDripStage, tokenFor, emailFromToken, validateMessages };
