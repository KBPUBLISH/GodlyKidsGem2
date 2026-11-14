const User = require('../models/User');
const EmailSubscriber = require('../models/EmailSubscriber');
const UpdateCampaign = require('../models/UpdateCampaign');
const Enrollment = require('../models/CampaignEnrollment');
const delivery = require('./campaignDelivery');
const { DAY, normalizeEmail, validEmail, escapeHtml, validateMessages } = require('./campaignPolicy');

async function enroll(campaign, dryRun = true) {
  if (!dryRun) await Enrollment.init();
  const seen = new Set();
  const result = { accounts: 0, eligible: 0, excluded: 0, enrolled: 0 };
  const cursor = User.find({ createdAt: { $lte: campaign.audienceCutoff }, email: { $type: 'string', $ne: '' } })
    .select('email username').lean().cursor();
  try {
    for await (const user of cursor) {
      const email = normalizeEmail(user.email);
      if (!validEmail(email) || seen.has(email)) continue;
      seen.add(email);
      result.accounts++;
      if (!await delivery.isEligible(email)) { result.excluded++; continue; }
      const subscriber = await EmailSubscriber.findOne({ email }).lean();
      result.eligible++;
      if (!dryRun) {
        try {
          const write = await Enrollment.updateOne({ campaign: campaign.key, email }, { $setOnInsert: {
            parentName: subscriber?.parentName || user.username || 'friend',
            dueAt: campaign.launchedAt, stage: 0, status: 'pending',
          } }, { upsert: true });
          result.enrolled += write.upsertedCount;
        } catch (error) { if (error.code !== 11000) throw error; }
      }
    }
  } finally { await cursor.close(); }
  return result;
}
function render(message, name, appUrl) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><p>Hi ${escapeHtml(name?.split(' ')[0] || 'friend')},</p>` +
    message.body.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('') +
    `<p><a href="${escapeHtml(appUrl)}">${escapeHtml(message.cta)}</a></p><p>God bless,<br>Michael<br>Godly Kids</p></div>`;
}
async function runUpdate(key, { limit = 100, dryRun = true } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be between 1 and 500');
  const campaign = await UpdateCampaign.findOne({ key }).lean();
  if (!campaign) throw new Error('Campaign not found');
  if (dryRun) return { dryRun: true, status: campaign.status, audience: await enroll(campaign, true), messages: campaign.messages,
    due: await Enrollment.countDocuments({ campaign: key, status: 'pending', dueAt: { $lte: new Date() } }) };
  if (campaign.status !== 'active') throw new Error('Campaign is not active');
  delivery.configuration();
  validateMessages(campaign.messages, campaign.appUrl);
  await Enrollment.init();
  const result = { sent: 0, suppressed: 0, needsReview: 0 };
  for (let i = 0; i < limit; i++) {
    if (!await UpdateCampaign.exists({ key, status: 'active' })) break;
    const recipient = await Enrollment.findOneAndUpdate({ campaign: key, status: 'pending', dueAt: { $lte: new Date() } },
      { $set: { status: 'sending' } }, { new: true, sort: { dueAt: 1, _id: 1 } }).lean();
    if (!recipient) break;
    try {
      const message = campaign.messages[recipient.stage];
      const outcome = await delivery.deliver({ campaign: key, email: recipient.email, stage: String(recipient.stage),
        subject: message.subject, html: render(message, recipient.parentName, campaign.appUrl) });
      if (outcome === 'sent') {
        result.sent++;
        // Day 1, day 3, day 7. Delays follow actual successful delivery, preventing catch-up bursts.
        const next = recipient.stage + 1;
        await Enrollment.updateOne({ _id: recipient._id }, { $set: { stage: next,
          status: next === 3 ? 'complete' : 'pending', dueAt: new Date(Date.now() + (next === 1 ? 2 : 4) * DAY) } });
      } else {
        const status = outcome === 'suppressed' ? 'suppressed' : 'needs_review';
        await Enrollment.updateOne({ _id: recipient._id }, { $set: { status } });
        result[status === 'suppressed' ? 'suppressed' : 'needsReview']++;
      }
    } catch {
      await Enrollment.updateOne({ _id: recipient._id }, { $set: { status: 'needs_review' } });
      result.needsReview++;
    }
  }
  return result;
}
module.exports = { enroll, render, runUpdate };
