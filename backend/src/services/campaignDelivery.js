const nodemailer = require('nodemailer');
const EmailSubscriber = require('../models/EmailSubscriber');
const EmailDelivery = require('../models/EmailDelivery');
const { normalizeEmail, eligible, tokenFor, escapeHtml } = require('./campaignPolicy');
let transport;
function configuration() {
  if (process.env.EMAIL_CAMPAIGNS_ENABLED !== 'true') throw new Error('Email campaigns are disabled');
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) throw new Error('Gmail credentials are missing');
  const base = new URL(process.env.PUBLIC_API_URL);
  if (base.protocol !== 'https:') throw new Error('PUBLIC_API_URL must use HTTPS');
  tokenFor('config@example.com', process.env.EMAIL_UNSUBSCRIBE_SECRET);
  return base.origin;
}
async function isEligible(email) {
  return eligible(await EmailSubscriber.findOne({ email: normalizeEmail(email) }).lean());
}
async function deliver({ campaign, email, stage, subject, html }) {
  const base = configuration();
  email = normalizeEmail(email);
  await EmailDelivery.init();
  let claim;
  try {
    claim = await EmailDelivery.create({ campaign, email, stage, status: 'sending' });
  } catch (error) {
    if (error.code === 11000) return 'already_claimed';
    throw error;
  }
  try {
    // Recheck immediately before contacting Gmail, including for queued recipients.
    if (!await isEligible(email)) {
      await EmailDelivery.updateOne({ _id: claim._id }, { $set: { status: 'suppressed' } });
      return 'suppressed';
    }
    const token = tokenFor(email, process.env.EMAIL_UNSUBSCRIBE_SECRET);
    const url = base + '/api/email-campaigns/unsubscribe?token=' + encodeURIComponent(token);
    transport ||= nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD } });
    const result = await transport.sendMail({
      from: `Michael from Godly Kids <${process.env.EMAIL_USER}>`,
      replyTo: process.env.SUPPORT_EMAIL || 'hello@kbpublish.org',
      to: email, subject,
      html: html + `<p style="font-size:12px"><a href="${escapeHtml(url)}">Unsubscribe from Godly Kids updates</a></p>`,
      headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (!result.accepted?.length) throw new Error('SMTP did not accept the message');
    await EmailDelivery.updateOne({ _id: claim._id }, { $set: { status: 'sent', sentAt: new Date(), messageId: result.messageId } });
    return 'sent';
  } catch (error) {
    // SMTP may have accepted the email even if acknowledgement failed. Never retry blindly.
    await EmailDelivery.updateOne({ _id: claim._id }, { $set: { status: 'needs_review' } });
    throw error;
  }
}
module.exports = { configuration, isEligible, deliver };
