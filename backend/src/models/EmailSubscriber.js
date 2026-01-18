const mongoose = require('mongoose');

const EmailSubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  source: {
    type: String,
    enum: ['onboarding_bonus', 'settings', 'landing', 'other'],
    default: 'onboarding_bonus',
  },
  bonusAwarded: {
    type: Boolean,
    default: false,
  },
  bonusAmount: {
    type: Number,
    default: 200,
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web', 'unknown'],
    default: 'unknown',
  },
  deviceId: {
    type: String,
  },
  optInUpdates: {
    type: Boolean,
    default: true,
  },
  unsubscribedAt: {
    type: Date,
  },
  parentName: {
    type: String,
  },
  kidsCount: {
    type: Number,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Index for quick lookups
EmailSubscriberSchema.index({ email: 1 });
EmailSubscriberSchema.index({ createdAt: -1 });
EmailSubscriberSchema.index({ source: 1 });

module.exports = mongoose.model('EmailSubscriber', EmailSubscriberSchema);
