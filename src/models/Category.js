const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
    },
    color: {
        type: String,
        default: '#6366f1', // Default indigo color
    },
    // Gradient color option (from-to format for Tailwind)
    gradientFrom: {
        type: String,
        default: '#6366f1', // Start color
    },
    gradientTo: {
        type: String,
        default: '#8b5cf6', // End color
    },
    icon: {
        type: String, // Icon name or emoji
    },
    // Category cover image for the app cards
    image: {
        type: String, // URL to GCS
    },
    // Category type: determines where this category appears in the app
    // 'Book' = Read page, 'Audio' = Listen page
    // Note: Not required to support legacy categories that don't have this field
    contentType: {
        type: String,
        enum: ['Book', 'Audio', null],
        default: 'Book',
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

categorySchema.pre('save', function() {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Category', categorySchema);

