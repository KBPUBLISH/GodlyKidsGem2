const mongoose = require('mongoose');

const devotionalStorySchema = new mongoose.Schema({
    // Template title (for portal management)
    title: {
        type: String,
        required: true,
    },
    
    // Display title shown to users (can include {childName} placeholder)
    displayTitle: {
        type: String,
        required: true,
    },
    
    // Story description (for portal preview)
    description: {
        type: String,
    },
    
    // Scripture reference
    scripture: {
        type: String,
        required: true,
    },
    
    // Full scripture text
    scriptureText: {
        type: String,
        required: true,
    },
    
    // Story content with {childName} placeholders
    // Example: "One day, {childName} went on an adventure..."
    content: {
        type: String,
        required: true,
    },
    
    // Target age groups
    ageGroups: [{
        type: String,
        enum: ['4-6', '6-8', '8-10', '10-12', 'all'],
    }],
    
    // Learning goal tags for matching with session goals
    goalTags: [{
        type: String,
        enum: ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'],
    }],
    
    // Background music URL (uploaded to GCS)
    backgroundMusicUrl: {
        type: String,
    },
    
    // Estimated duration in minutes
    estimatedDuration: {
        type: Number,
        default: 3,
    },
    
    // AI prompt for generating personalized cover
    // Example: "A brave child standing in a magical forest with sunlight streaming through trees"
    coverPrompt: {
        type: String,
    },
    
    // Default cover image (fallback if AI generation fails)
    defaultCoverUrl: {
        type: String,
    },
    
    // Publication status
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    
    // Reflection questions for after the story
    reflectionQuestions: [{
        question: String,
        parentTip: String,
        emoji: String,
    }],
    
    // TTS voice preference (optional override)
    preferredVoice: {
        type: String,
        enum: ['Kore', 'Aoede', 'Leda', 'Charon', 'Fenrir', 'Orus', 'Puck', 'Zephyr'],
    },
    
    // Track usage
    playCount: {
        type: Number,
        default: 0,
    },
    
    // Order for manual sorting
    order: {
        type: Number,
        default: 0,
    },
    
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// Index for efficient querying (separate indexes to avoid parallel array issue)
devotionalStorySchema.index({ status: 1 });
devotionalStorySchema.index({ ageGroups: 1 });
devotionalStorySchema.index({ goalTags: 1 });
devotionalStorySchema.index({ createdAt: -1 });

// Method to personalize content for a specific child
devotionalStorySchema.methods.personalizeContent = function(childName) {
    return {
        title: this.displayTitle.replace(/\{childName\}/g, childName),
        content: this.content.replace(/\{childName\}/g, childName),
        scripture: this.scripture,
        scriptureText: this.scriptureText,
        backgroundMusicUrl: this.backgroundMusicUrl,
        coverPrompt: this.coverPrompt ? this.coverPrompt.replace(/\{childName\}/g, childName) : null,
        defaultCoverUrl: this.defaultCoverUrl,
        reflectionQuestions: this.reflectionQuestions,
        estimatedDuration: this.estimatedDuration,
    };
};

// Static method to find a random story matching criteria
devotionalStorySchema.statics.findRandomMatching = async function(options = {}) {
    const { ageGroup, goalTag, excludeIds = [] } = options;
    
    const query = { status: 'published' };
    
    if (ageGroup && ageGroup !== 'all') {
        query.$or = [
            { ageGroups: ageGroup },
            { ageGroups: 'all' }
        ];
    }
    
    if (goalTag) {
        query.goalTags = goalTag;
    }
    
    if (excludeIds.length > 0) {
        query._id = { $nin: excludeIds.map(id => mongoose.Types.ObjectId(id)) };
    }
    
    // Get count first, then pick random
    const count = await this.countDocuments(query);
    if (count === 0) {
        // Fallback: try without goal tag filter
        delete query.goalTags;
        const fallbackCount = await this.countDocuments(query);
        if (fallbackCount === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * fallbackCount);
        return this.findOne(query).skip(randomIndex);
    }
    
    const randomIndex = Math.floor(Math.random() * count);
    return this.findOne(query).skip(randomIndex);
};

module.exports = mongoose.model('DevotionalStory', devotionalStorySchema);
