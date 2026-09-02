const mongoose = require('mongoose');
const { platformCentsPerToken } = require('../config/creatorEarnings');

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
        // Planned episodes are announcements only, so they have no audio yet.
        required: function () { return !this.planned; },
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

    // ---- Serialized release (in-progress series) ----
    // Announced but not published yet. Kids who pledged see it listed with its
    // release window; it becomes playable when the creator uploads the audio.
    planned: {
        type: Boolean,
        default: false,
    },
    // Release window shown on planned episodes (month precision is enough).
    releaseDate: {
        type: Date,
    },
    // Episodes released AFTER the series was published still need a human to
    // look at them, so they stay hidden from the app until approved.
    reviewStatus: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'approved',
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
    
    // Pricing (in tokens) - for in-app token purchases
    priceTokens: {
        type: Number,
        required: true,
        min: 1,
        max: 500,
    },
    
    // Pricing (in USD) - for Stripe purchases via webview
    priceUSD: {
        type: Number,
        min: 0.99,
        max: 99.99,
        default: null, // null means not available for USD purchase
    },
    
    // Whether USD purchase is enabled (allows Stripe checkout)
    usdPurchaseEnabled: {
        type: Boolean,
        default: false,
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
    
    // USD sales stats (Stripe)
    usdPurchaseCount: {
        type: Number,
        default: 0,
    },
    totalUSDEarned: {
        type: Number, // In cents
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

    // ==================== SERIES PROGRESS ====================
    // A series with planned episodes is still being written. Kids can buy it
    // anyway as a pledge: they get what exists now plus every future episode.
    // Derived from items in the pre-save hook below so it cannot drift.
    seriesStatus: {
        type: String,
        enum: ['complete', 'in-progress'],
        default: 'complete',
        index: true,
    },
    // Creator's promise about cadence, e.g. "One new chapter every month".
    releasePlan: {
        type: String,
    },
    // Denormalized counts (derived) so list queries and the app don't have to
    // walk items, and so they survive .lean() reads.
    releasedEpisodeCount: {
        type: Number,
        default: 0,
    },
    plannedEpisodeCount: {
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

/**
 * Series progress is always derived from the episode list, so the progress bar
 * in the app can never disagree with the episodes shown underneath it.
 * Rejected episodes don't count as released — they're hidden from the app.
 */
function deriveSeriesProgress(items = []) {
    const releasedEpisodeCount = items.filter(
        (item) => !item.planned && item.reviewStatus !== 'rejected'
    ).length;
    const plannedEpisodeCount = items.filter((item) => item.planned).length;
    return {
        releasedEpisodeCount,
        plannedEpisodeCount,
        seriesStatus: plannedEpisodeCount > 0 ? 'in-progress' : 'complete',
    };
}

hubPlaylistSchema.pre('save', function (next) {
    Object.assign(this, deriveSeriesProgress(this.items || []));
    next();
});

// Backers = everyone who bought the series, which for an unfinished series is
// a pledge toward the remaining episodes.
hubPlaylistSchema.virtual('backerCount').get(function() {
    return this.purchaseCount || 0;
});

// Virtual for creator earnings calculation. Uses the platform rate, so it is
// an estimate for creators on a negotiated rate.
hubPlaylistSchema.virtual('estimatedCreatorEarnings').get(function() {
    return Math.round(this.totalTokensEarned * platformCentsPerToken()); // In cents
});

module.exports = mongoose.model('HubPlaylist', hubPlaylistSchema);
module.exports.deriveSeriesProgress = deriveSeriesProgress;
