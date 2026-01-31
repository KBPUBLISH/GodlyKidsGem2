const mongoose = require('mongoose');

/**
 * ReverseTrialDevice Model
 * 
 * Tracks devices that have used a reverse trial permanently.
 * This prevents users from getting multiple trials by:
 * - Creating new accounts on the same device
 * - Signing out and starting fresh
 * 
 * Once a device has used a reverse trial, it cannot use one again.
 */
const reverseTrialDeviceSchema = new mongoose.Schema({
    // The device identifier (from localStorage)
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    
    // Reference to the user who used the trial
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppUser',
    },
    
    // Email of the user (if available) for reference
    email: {
        type: String,
        sparse: true,
    },
    
    // When the reverse trial was started on this device
    trialStartedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    
    // When the trial ended (7 days after start)
    trialEndedAt: {
        type: Date,
    },
    
    // Whether the user converted to paid
    converted: {
        type: Boolean,
        default: false,
    },
    
    // When conversion happened (if any)
    convertedAt: {
        type: Date,
    },
    
    // Platform info
    platform: {
        type: String,
        enum: ['web', 'ios', 'android', 'unknown'],
        default: 'unknown',
    },
    
}, {
    timestamps: true
});

// Index for analytics queries
reverseTrialDeviceSchema.index({ trialStartedAt: -1 });
reverseTrialDeviceSchema.index({ converted: 1 });

module.exports = mongoose.model('ReverseTrialDevice', reverseTrialDeviceSchema);
