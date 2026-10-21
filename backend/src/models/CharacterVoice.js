const mongoose = require('mongoose');

const characterVoiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  showName: { type: String, required: true },
  description: { type: String, default: '' },
  elevenLabsVoiceId: { type: String, required: true },
  previewAudioUrl: { type: String, default: '' },
  voiceSettings: {
    stability: { type: Number, default: 0.5, min: 0, max: 1 },
    similarityBoost: { type: Number, default: 0.75, min: 0, max: 1 },
    style: { type: Number, default: 0, min: 0, max: 1 },
    useSpeakerBoost: { type: Boolean, default: true },
  },
  // Character metadata for better voice selection
  characterInfo: {
    age: { type: String, enum: ['child', 'teen', 'young-adult', 'adult', 'elderly', ''], default: '' },
    gender: { type: String, enum: ['male', 'female', 'neutral', ''], default: '' },
    personality: [String],
    notes: { type: String, default: '' },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

characterVoiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
characterVoiceSchema.index({ showName: 1, name: 1 }, { unique: true });
characterVoiceSchema.index({ isActive: 1 });

module.exports = mongoose.model('CharacterVoice', characterVoiceSchema);
