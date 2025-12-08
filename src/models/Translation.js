const mongoose = require('mongoose');

// Translation schema - caches translated content per page + language
const translationSchema = new mongoose.Schema({
    // Reference to the original page
    pageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Page',
        required: true,
        index: true,
    },
    
    // Language code (e.g., 'es', 'fr', 'de', 'pt')
    languageCode: {
        type: String,
        required: true,
        index: true,
    },
    
    // Original English text (for reference/comparison)
    originalText: {
        type: String,
    },
    
    // Translated main text
    translatedText: {
        type: String,
    },
    
    // Translated text boxes (preserves original styling/positioning)
    translatedTextBoxes: [{
        originalText: String,
        translatedText: String,
        // Keep reference to original textBox index
        textBoxIndex: Number,
    }],
    
    // Translation metadata
    translatedAt: {
        type: Date,
        default: Date.now,
    },
    
    // Track if translation needs refresh (if original changed)
    originalHash: {
        type: String, // MD5 hash of original text for change detection
    },
});

// Compound index for efficient lookups
translationSchema.index({ pageId: 1, languageCode: 1 }, { unique: true });

module.exports = mongoose.model('Translation', translationSchema);

