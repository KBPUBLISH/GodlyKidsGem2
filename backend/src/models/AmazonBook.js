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
    
    // Cover image
    coverImage: {
        type: String,
        required: true,
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
