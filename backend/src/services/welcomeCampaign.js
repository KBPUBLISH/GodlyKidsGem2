const AppUser = require('../models/AppUser');
const EmailDelivery = require('../models/EmailDelivery');
const templates = require('../campaigns/welcome');
const delivery = require('./campaignDelivery');
const { DAY, STAGES, normalizeEmail, validEmail, escapeHtml, getDripStage } = require('./campaignPolicy');
async function runWelcome({ limit = 100, dryRun = true } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be between 1 and 500');
  if (!dryRun) delivery.configuration();
  const result = { dryRun, eligible: 0, sent: 0, suppressed: 0, needsReview: 0 };
  const seen = new Set();
  // Retain the new-signup window; completed/claimed records cannot starve later users.
  const cursor = AppUser.find({ email: { $type: 'string', $ne: '' }, createdAt: { $gte: new Date(Date.now() - 8 * DAY) }, dripCompleted: { $ne: true } })
    .sort({ createdAt: 1, _id: 1 }).lean().cursor();
  try {
    for await (const user of cursor) {
      const email = normalizeEmail(user.email);
      if (!validEmail(email) || seen.has(email)) continue;
      seen.add(email);
      const records = await EmailDelivery.find({ campaign: 'welcome-v1', email }).lean();
      if (records.some(r => ['sending', 'needs_review'].includes(r.status))) { result.needsReview++; continue; }
      const sent = { ...(user.dripEmailsSent || {}) };
      let last = user.lastDripEmailAt;
      for (const record of records.filter(r => r.status === 'sent')) {
        sent[record.stage] = record.sentAt;
        if (!last || record.sentAt > new Date(last)) last = record.sentAt;
      }
      if (STAGES.every(stage => sent[stage])) {
        if (!dryRun) await AppUser.updateOne({ _id: user._id }, { $set: { dripCompleted: true, dripEmailsSent: sent } });
        continue;
      }
      const stage = getDripStage(user.createdAt, sent, last);
      if (!stage || records.some(r => r.stage === stage)) continue;
      if (!await delivery.isEligible(email)) { result.suppressed++; continue; }
      result.eligible++;
      if (!dryRun) {
        const name = user.parentName?.split(' ')[0] || 'friend';
        try {
          const outcome = await delivery.deliver({ campaign: 'welcome-v1', email, stage,
            subject: templates[stage].subject.replace('${firstName}', name.replace(/[\r\n]/g, ' ')),
            html: templates[stage].getHtml(escapeHtml(name), ['trial', 'reverse_trial'].includes(user.subscriptionStatus) || user.reverseTrialActive) });
          if (outcome === 'sent') {
            result.sent++;
            await AppUser.updateOne({ _id: user._id }, { $set: {
              [`dripEmailsSent.${stage}`]: new Date(), lastDripEmailAt: new Date(),
              ...(stage === 'day7_final' ? { dripCompleted: true } : {}),
            } });
          }
        } catch { result.needsReview++; }
      }
      if (result.eligible >= limit) break;
    }
  } finally { await cursor.close(); }
  return result;
}
module.exports = { runWelcome };
