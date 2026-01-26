const mongoose = require('mongoose');

// Same structure as regular playlist audio items
const hubAudioItemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    coverImage: {
        type: String, // URL to GCS
    },
    audioUrl: {
        type: String, // URL to GCS
        required: true,
    },
    duration: {
        type: Number, // Duration in seconds
    },
    order: {
        type: Number,
        default: 0,
    },
    playCount: {
        type: Number,
        default: 0,
    },
}, { _id: true });

const hubPlaylistSchema = new mongoose.Schema({
    // Creator reference
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
        required: true,
        index: true,
    },
    
    // Content info (same as regular Playlist)
    title: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    coverImage: {
        type: String, // URL to GCS
    },
    category: {
        type: String,
        default: 'Godly Hub',
    },
    categories: {
        type: [String],
        default: ['Godly Hub'],
    },
    type: {
        type: String,
        enum: ['Song', 'Audiobook'],
        required: true,
        default: 'Audiobook',
    },
    items: [hubAudioItemSchema],
    
    // Pricing (in tokens)
    priceTokens: {
        type: Number,
        required: true,
        min: 1,
        max: 500,
    },
    
    // Review status
    status: {
        type: String,
        enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
        default: 'draft',
        index: true,
    },
    reviewNotes: {
        type: String, // Admin notes when rejecting
    },
    reviewedAt: {
        type: Date,
    },
    reviewedBy: {
        type: String, // Admin email who reviewed
    },
    submittedAt: {
        type: Date,
    },
    publishedAt: {
        type: Date,
    },
    
    // Sales stats
    purchaseCount: {
        type: Number,
        default: 0,
    },
    totalTokensEarned: {
        type: Number,
        default: 0,
    },
    
    // Engagement stats
    playCount: {
        type: Number,
        default: 0,
    },
    favoriteCount: {
        type: Number,
        default: 0,
    },
    likeCount: {
        type: Number,
        default: 0,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    
    // Age recommendation
    minAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    
    // Featured in Hub
    isFeatured: {
        type: Boolean,
        default: false,
    },
    featuredOrder: {
        type: Number,
        default: 0,
    },
    
}, {
    timestamps: true,
});

// Indexes for queries
hubPlaylistSchema.index({ status: 1, publishedAt: -1 });
hubPlaylistSchema.index({ creatorId: 1, status: 1 });
hubPlaylistSchema.index({ categories: 1, status: 1 });
hubPlaylistSchema.index({ isFeatured: 1, featuredOrder: 1 });
hubPlaylistSchema.index({ purchaseCount: -1 });

// Virtual for creator earnings calculation
hubPlaylistSchema.virtual('estimatedCreatorEarnings').get(function() {
    // Rough estimate: tokens * $0.68 (after Apple 15%) * 0.80 (creator 80%)
    // This gives ~$0.54 per token to creator
    return Math.round(this.totalTokensEarned * 54); // In cents
});

module.exports = mongoose.model('HubPlaylist', hubPlaylistSchema);
