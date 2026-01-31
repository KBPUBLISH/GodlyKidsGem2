const mongoose = require('mongoose');

// Track individual game play sessions
const gamePlayEventSchema = new mongoose.Schema({
    // Game identifier (matches Game.gameId)
    gameId: {
        type: String,
        required: true,
        index: true,
    },
    // Game name (denormalized for quick display)
    gameName: {
        type: String,
    },
    // User who played (deviceId or email)
    userId: {
        type: String,
        required: true,
        index: true,
    },
    // Kid profile name (if playing under a kid profile)
    kidName: {
        type: String,
    },
    // Session duration in seconds
    sessionDurationSeconds: {
        type: Number,
        default: 0,
    },
    // Game-specific score (optional)
    score: {
        type: Number,
        default: 0,
    },
    // Stars earned (1-3, or 0 if not completed)
    starsEarned: {
        type: Number,
        default: 0,
        min: 0,
        max: 3,
    },
    // Coins earned from this session
    coinsEarned: {
        type: Number,
        default: 0,
    },
    // Whether the game was completed
    completed: {
        type: Boolean,
        default: false,
    },
    // When the game was played
    playedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    // Platform (ios, android, web)
    platform: {
        type: String,
        enum: ['ios', 'android', 'web', 'unknown'],
        default: 'unknown',
    },
    // Additional game-specific metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
});

// Compound indexes for efficient queries
gamePlayEventSchema.index({ gameId: 1, playedAt: -1 });
gamePlayEventSchema.index({ userId: 1, playedAt: -1 });
gamePlayEventSchema.index({ playedAt: -1 });

// TTL index to automatically delete old play events (keep 90 days)
gamePlayEventSchema.index({ playedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('GamePlayEvent', gamePlayEventSchema);
