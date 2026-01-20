const mongoose = require('mongoose');

const campaignUpdateSchema = new mongoose.Schema({
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DonationCampaign',
        required: true,
        index: true
    },
    // Type of update
    type: {
        type: String,
        enum: ['photo', 'video', 'milestone', 'thankyou'],
        default: 'photo'
    },
    // Main content
    caption: {
        type: String,
        required: true,
        maxlength: 500
    },
    // Media - can have multiple images
    images: [{
        url: String,
        caption: String
    }],
    // Optional video
    videoUrl: String,
    // Location where the donation was given
    location: String,
    // Number of items donated in this update
    itemsDonated: {
        type: Number,
        default: 0
    },
    // Likes/hearts from users
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: String  // Device IDs who liked
    }],
    // Is this pinned to top?
    isPinned: {
        type: Boolean,
        default: false
    },
    // Is this visible in the app?
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
campaignUpdateSchema.index({ campaignId: 1, createdAt: -1 });
campaignUpdateSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('CampaignUpdate', campaignUpdateSchema);
