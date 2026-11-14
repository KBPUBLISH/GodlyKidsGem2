const mongoose = require('mongoose');
const message = new mongoose.Schema({ subject: String, body: String, cta: String }, { _id: false });
const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  status: { type: String, enum: ['draft', 'active', 'paused'], default: 'draft' },
  // Audience is fixed to accounts created before this date.
  audienceCutoff: { type: Date, required: true },
  appUrl: { type: String, default: 'https://app.godlykids.com/' },
  messages: [message],
  launchedAt: Date,
}, { timestamps: true });
module.exports = mongoose.model('UpdateCampaign', schema);
