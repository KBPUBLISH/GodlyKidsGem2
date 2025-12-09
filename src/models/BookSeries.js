const mongoose = require('mongoose');

const bookSeriesSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    coverImage: {
        type: String,
        required: true,
    },
    // Array of book references in order
    books: [{
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Book',
            required: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    }],
    // Age range
    minAge: {
        type: Number,
        default: 0,
    },
    maxAge: {
        type: Number,
        default: 12,
    },
    // Target audience level
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'all'],
        default: 'all',
    },
    // Category for sorting/filtering
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    },
    // Publication status
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
    // Premium content flag
    isMembersOnly: {
        type: Boolean,
        default: false,
    },
    // Featured flag
    isFeatured: {
        type: Boolean,
        default: false,
    },
    // Display order for sorting
    displayOrder: {
        type: Number,
        default: 0,
    },
    // Analytics
    viewCount: {
        type: Number,
        default: 0,
    },
    // Author/creator info
    author: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

// Index for common queries
bookSeriesSchema.index({ status: 1, displayOrder: 1 });
bookSeriesSchema.index({ category: 1, status: 1 });
bookSeriesSchema.index({ isFeatured: 1, status: 1 });

module.exports = mongoose.model('BookSeries', bookSeriesSchema);

