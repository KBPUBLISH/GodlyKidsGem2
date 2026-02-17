const mongoose = require('mongoose');

/**
 * Saved character (e.g. Bible character) for monthly custom books.
 * Used in portal "character library"; referenced by MonthlyBookTemplate.
 * Internal tag (e.g. bible_noah) avoids collision with kid names.
 */
const savedCharacterSchema = new mongoose.Schema({
    // Unique internal tag - never use bare first name (e.g. bible_noah, bible_david)
    internalTag: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    // Display name for portal and app (e.g. "Noah", "David")
    displayName: {
        type: String,
        required: true,
    },
    // Optional scripture reference
    scriptureReference: {
        type: String,
    },
    // Optional reference image URL for image generation
    referenceImageUrl: {
        type: String,
    },
    // Style tag matching app CHARACTER_STYLES (pixar, minecraft, etc.)
    styleId: {
        type: String,
        enum: ['pixar', 'minecraft', 'anime', 'lego', 'cartoon', 'illustrated', 'disney'],
        default: undefined,
    },
    // Style prompt for consistent appearance; optional when styleId is set (can derive from style)
    stylePrompt: {
        type: String,
        default: '',
    },
    // For portal ordering
    order: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'active',
    },
}, { timestamps: true });

savedCharacterSchema.index({ status: 1 });
savedCharacterSchema.index({ order: 1 });

module.exports = mongoose.model('SavedCharacter', savedCharacterSchema);
