const mongoose = require('mongoose');

/**
 * One row per personalised notification sent (or being sent) to an AppUser.
 * The unique (userKey, dedupeKey) index is what guarantees a message is never sent twice,
 * even when two job runs overlap: a send is only attempted after its row is inserted.
 */
const notificationLogSchema = new mongoose.Schema({
    userKey: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    ruleId: { type: String },
    category: { type: String },
    title: { type: String },
    status: { type: String, enum: ['pending', 'sent'], default: 'pending' },
    sentAt: { type: Date, default: Date.now },
});

notificationLogSchema.index({ userKey: 1, dedupeKey: 1 }, { unique: true });
notificationLogSchema.index({ userKey: 1, sentAt: -1 });
// Old history only matters for dedupe of one-off news; let it age out.
notificationLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.models.NotificationLog || mongoose.model('NotificationLog', notificationLogSchema);
