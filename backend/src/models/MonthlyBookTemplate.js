const mongoose = require('mongoose');

/**
 * Story page template - text supports {childName} placeholder.
 */
const storyPageSchema = new mongoose.Schema({
    pageNumber: { type: Number, required: true },
    text: { type: String, required: true }, // Supports {childName}
    sceneDescription: { type: String }, // Optional prompt for image generation
}, { _id: false });

/**
 * Monthly book template - one per Bible character story (12 total for MVP).
 * User picks one in the app; backend uses it to generate their custom book.
 */
const monthlyBookTemplateSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    // Which Bible character this story is about (ref to SavedCharacter)
    bibleCharacterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavedCharacter',
        required: true,
    },
    // Story pages (15-20); text may contain {childName}
    storyPages: [storyPageSchema],
    order: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
}, { timestamps: true });

monthlyBookTemplateSchema.index({ status: 1 });
monthlyBookTemplateSchema.index({ bibleCharacterId: 1 });

module.exports = mongoose.model('MonthlyBookTemplate', monthlyBookTemplateSchema);
