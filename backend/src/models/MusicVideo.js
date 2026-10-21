const mongoose = require('mongoose');

const musicVideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        default: 'Kingdom Builders Publishing',
    },
    description: {
        type: String,
    },
    // 16:9 thumbnail artwork (WebP-optimized via the cover pipeline)
    thumbnailUrl: {
        type: String,
    },
    // The playable video file (GCS URL)
    videoUrl: {
        type: String,
    },
    duration: {
        type: Number, // seconds
        default: 0,
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
    // Whether this appears in the rotating "hero" carousel on the Music Videos shelf
    isFeatured: {
        type: Boolean,
        default: false,
    },
    featuredOrder: {
        type: Number,
        default: 0,
    },
    order: {
        type: Number,
        default: 0,
    },
    // Music videos are a members-only perk by default
    isMembersOnly: {
        type: Boolean,
        default: true,
    },
    minAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

musicVideoSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

musicVideoSchema.index({ status: 1, isFeatured: -1, featuredOrder: 1, order: 1 });

module.exports = mongoose.model('MusicVideo', musicVideoSchema);
