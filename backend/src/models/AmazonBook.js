const mongoose = require('mongoose');

const amazonBookSchema = new mongoose.Schema({
    // Basic book information
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
    
    // Amazon product details
    amazonUrl: {
        type: String,
        required: true,
    },
    asin: {
        type: String, // Amazon Standard Identification Number (optional)
    },
    price: {
        type: String, // Display price (e.g., "$12.99")
    },
    
    // Cover image (main)
    coverImage: {
        type: String,
        required: true,
    },

    // Additional gallery images shown on the book detail page
    images: {
        type: [String],
        default: [],
    },

    // Optional promo video (YouTube / Vimeo / direct mp4 URL)
    promoVideoUrl: {
        type: String,
        default: '',
    },

    // Parent / reader reviews shown on the bookstore detail page
    reviews: {
        type: [
            new mongoose.Schema(
                {
                    author: { type: String, required: true },
                    rating: { type: Number, min: 1, max: 5, default: 5 },
                    text: { type: String, default: '' },
                    date: { type: Date, default: Date.now },
                },
                { _id: true }
            ),
        ],
        default: [],
    },

    // Categorization
    category: {
        type: String,
        default: 'Other',
    },
    categories: {
        type: [String],
        default: [],
    },
    
    // Age targeting
    minAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    maxAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    
    // Status
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    
    // Featured on explore page carousel
    isFeatured: {
        type: Boolean,
        default: false,
    },
    
    // Order in the featured carousel (lower = first)
    featuredOrder: {
        type: Number,
        default: 0,
    },
    
    // Display settings
    badgeText: {
        type: String, // e.g., "Best Seller", "New Release", "Staff Pick"
    },
    badgeColor: {
        type: String,
        default: '#f59e0b', // Amber color for badge
    },
    
    // Analytics
    clickCount: {
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

// Update updatedAt on save
amazonBookSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

// Indexes for common queries
amazonBookSchema.index({ status: 1, createdAt: -1 });
amazonBookSchema.index({ isFeatured: 1, featuredOrder: 1 });
amazonBookSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('AmazonBook', amazonBookSchema);
