const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  campaign: { type: String, required: true },
  email: { type: String, required: true },
  stage: { type: String, required: true },
  status: { type: String, enum: ['sending', 'sent', 'suppressed', 'needs_review'], required: true },
  sentAt: Date,
  messageId: String,
}, { timestamps: true });
// A permanent claim prevents concurrent runs or ambiguous SMTP failures from resending.
schema.index({ campaign: 1, email: 1, stage: 1 }, { unique: true });
module.exports = mongoose.model('EmailDelivery', schema);
