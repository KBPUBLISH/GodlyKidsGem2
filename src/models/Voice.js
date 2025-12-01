const mongoose = require('mongoose');

const voiceSchema = new mongoose.Schema({
    voiceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    customName: {
        type: String, // Custom name set by admin (overrides name if set)
    },
    category: {
        type: String,
        default: 'premade'
    },
    previewUrl: {
        type: String
    },
    enabled: {
        type: Boolean,
        default: true
    },
    // Additional metadata
    description: {
        type: String
    },
    ageGroup: {
        type: String,
        enum: ['child', 'teen', 'adult', 'all'],
        default: 'all'
    },
    language: {
        type: String,
        default: 'en'
    },
    characterImage: {
        type: String, // URL to character image (stored in GCS)
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt before saving
voiceSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

module.exports = mongoose.model('Voice', voiceSchema);


