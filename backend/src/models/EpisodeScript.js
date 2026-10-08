const mongoose = require('mongoose');

const episodeScriptLineSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['dialogue', 'sound-effect', 'stage-direction'], 
    required: true 
  },
  characterName: { type: String, default: '' },
  dialogue: { type: String, default: '' },
  soundEffect: { type: String, default: '' },
  emotion: { type: String, default: '' },
  voiceId: { type: String, default: '' },
  elevenLabsSettings: {
    stability: { type: Number, default: 0.5, min: 0, max: 1 },
    similarityBoost: { type: Number, default: 0.75, min: 0, max: 1 },
    style: { type: Number, default: 0, min: 0, max: 1 },
    useSpeakerBoost: { type: Boolean, default: true },
  },
  previewAudioUrl: { type: String, default: '' },
  previewGeneratedAt: { type: Date },
}, { _id: false });

const productionSegmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startLineIndex: { type: Number, required: true },
  endLineIndex: { type: Number, required: true },
  audioUrl: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  error: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const episodeScriptSchema = new mongoose.Schema({
  title: { type: String, required: true },
  showName: { type: String, required: true },
  episodeNumber: { type: Number },
  season: { type: Number },
  description: { type: String, default: '' },
  scriptText: { type: String, default: '' },
  lines: [episodeScriptLineSchema],
  status: { 
    type: String, 
    enum: ['draft', 'parsed', 'voice-assigned', 'in-production', 'completed'], 
    default: 'draft' 
  },
  productionSegments: [productionSegmentSchema],
  finalAudioUrl: { type: String, default: '' },
  totalDuration: { type: Number, default: 0 },
  metadata: {
    targetDuration: { type: Number },
    notes: { type: String, default: '' },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

episodeScriptSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
episodeScriptSchema.index({ showName: 1, episodeNumber: 1 });
episodeScriptSchema.index({ status: 1 });
episodeScriptSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('EpisodeScript', episodeScriptSchema);
