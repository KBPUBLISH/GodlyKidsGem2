const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  campaign: { type: String, required: true },
  email: { type: String, required: true },
  parentName: String,
  stage: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'sending', 'complete', 'suppressed', 'needs_review'], default: 'pending' },
  dueAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ campaign: 1, email: 1 }, { unique: true });
schema.index({ campaign: 1, status: 1, dueAt: 1 });
module.exports = mongoose.model('CampaignEnrollment', schema);
