const mongoose = require('mongoose');

const storyBackgroundSchema = new mongoose.Schema({
    // Display name
    name: {
        type: String,
        required: true,
    },
    
    // GCS URL for the background image
    imageUrl: {
        type: String,
        required: true,
    },
    
    // Thumbnail URL (smaller version for portal preview)
    thumbnailUrl: {
        type: String,
    },
    
    // Category for organization
    category: {
        type: String,
        enum: ['nature', 'home', 'adventure', 'biblical', 'fantasy', 'school', 'outdoor', 'other'],
        default: 'other',
    },
    
    // Tags for searching/filtering
    tags: [{
        type: String,
    }],
    
    // Description (for accessibility and searching)
    description: {
        type: String,
    },
    
    // Mood/atmosphere tags (helps match with story tone)
    moodTags: [{
        type: String,
        enum: ['happy', 'calm', 'adventurous', 'mysterious', 'peaceful', 'exciting', 'cozy', 'dramatic'],
    }],
    
    // Learning goal associations (for smart suggestions)
    goalTags: [{
        type: String,
        enum: ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'],
    }],
    
    // Suggested character position (default placement)
    suggestedCharacterPosition: {
        x: { type: Number, default: 50 },     // Center X
        y: { type: Number, default: 70 },     // Lower third
        scale: { type: Number, default: 1 },
    },
    
    // Image dimensions (for aspect ratio info)
    width: { type: Number },
    height: { type: Number },
    aspectRatio: { type: String },  // e.g., "16:9", "9:16", "1:1"
    
    // Preferred orientation
    orientation: {
        type: String,
        enum: ['portrait', 'landscape', 'square'],
        default: 'portrait',
    },
    
    // Whether this is a premium-only background
    isPremium: {
        type: Boolean,
        default: false,
    },
    
    // Use count (for popularity tracking)
    useCount: {
        type: Number,
        default: 0,
    },
    
    // Status
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active',
    },
    
    // Order for manual sorting
    order: {
        type: Number,
        default: 0,
    },
    
}, {
    timestamps: true,
});

// Indexes for efficient querying
storyBackgroundSchema.index({ category: 1 });
storyBackgroundSchema.index({ tags: 1 });
storyBackgroundSchema.index({ moodTags: 1 });
storyBackgroundSchema.index({ goalTags: 1 });
storyBackgroundSchema.index({ status: 1 });
storyBackgroundSchema.index({ orientation: 1 });

// Static method to find backgrounds matching criteria
storyBackgroundSchema.statics.findMatching = async function(options = {}) {
    const { category, tags, moodTags, goalTags, orientation, isPremium, limit = 20 } = options;
    
    const query = { status: 'active' };
    
    if (category) query.category = category;
    if (orientation) query.orientation = orientation;
    if (isPremium !== undefined) query.isPremium = isPremium;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (moodTags && moodTags.length > 0) query.moodTags = { $in: moodTags };
    if (goalTags && goalTags.length > 0) query.goalTags = { $in: goalTags };
    
    return this.find(query)
        .sort({ useCount: -1, order: 1, createdAt: -1 })
        .limit(limit);
};

// Static method to increment use count
storyBackgroundSchema.statics.recordUse = async function(backgroundId) {
    await this.updateOne(
        { _id: backgroundId },
        { $inc: { useCount: 1 } }
    );
};

module.exports = mongoose.model('StoryBackground', storyBackgroundSchema);
