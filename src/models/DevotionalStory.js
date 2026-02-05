const mongoose = require('mongoose');

// Sub-schema for text boxes on illustrated pages
const textBoxSchema = new mongoose.Schema({
    text: { type: String, required: true },      // Text content (supports {childName})
    x: { type: Number, default: 50 },            // X position (0-100%)
    y: { type: Number, default: 80 },            // Y position (0-100%)
    width: { type: Number, default: 80 },        // Width (0-100%)
    fontSize: { type: Number, default: 18 },     // Font size in px
    color: { type: String, default: '#FFFFFF' }, // Text color
    fontFamily: { type: String, default: 'Patrick Hand' },
    alignment: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    showBackground: { type: Boolean, default: true },  // Semi-transparent bg
    backgroundColor: { type: String, default: 'rgba(0,0,0,0.6)' },
}, { _id: false });

// Sub-schema for illustrated story pages
const illustratedPageSchema = new mongoose.Schema({
    pageNumber: { type: Number, required: true },
    
    // Background
    backgroundUrl: { type: String },             // Pre-set background image URL
    backgroundPrompt: { type: String },          // Optional: AI generation prompt
    
    // Character placement
    characterPose: {                             // Which pose to use
        type: String,
        enum: ['standing_front', 'standing_happy', 'sitting', 'reading', 
               'praying', 'walking', 'thinking', 'pointing', 'waving', 'celebrating', 'none'],
        default: 'standing_front'
    },
    characterPosition: {
        x: { type: Number, default: 50 },        // X position (0-100%)
        y: { type: Number, default: 70 },        // Y position (0-100%)
        scale: { type: Number, default: 1 },     // Scale factor (0.5-2.0)
        flipHorizontal: { type: Boolean, default: false }
    },
    showCharacter: { type: Boolean, default: true }, // Whether to show character
    
    // Text content
    textBoxes: [textBoxSchema],
    
    // TTS text (may differ from displayed text for better narration)
    ttsText: { type: String },
    
    // Optional page-specific audio
    pageAudioUrl: { type: String },
    soundEffectUrl: { type: String },
    
}, { _id: false });

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
    
    // ============================================
    // STORY TYPE: Text-based OR Illustrated
    // ============================================
    
    // Flag to distinguish illustrated stories from text-only
    isIllustrated: {
        type: Boolean,
        default: false,
    },
    
    // For TEXT-BASED stories (isIllustrated = false):
    // Story content with {childName} placeholders
    // Example: "One day, {childName} went on an adventure..."
    content: {
        type: String,
        required: function() { return !this.isIllustrated; },
    },
    
    // For ILLUSTRATED stories (isIllustrated = true):
    // Array of pages with backgrounds, character positions, and text
    pages: [illustratedPageSchema],
    
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
    
    // AI-generated scene image (for audio story player)
    sceneImageUrl: {
        type: String,
    },
    
    // Custom prompt for scene image generation
    sceneImagePrompt: {
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
    
    // TTS voice preference (ElevenLabs voice ID)
    preferredVoice: {
        type: String,
        // No enum restriction - accepts any ElevenLabs voice ID
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
devotionalStorySchema.index({ isIllustrated: 1 });

// Method to personalize content for a specific child
devotionalStorySchema.methods.personalizeContent = function(childName) {
    const replaceChildName = (str) => str ? str.replace(/\{childName\}/g, childName) : str;
    
    const result = {
        title: replaceChildName(this.displayTitle),
        scripture: this.scripture,
        scriptureText: this.scriptureText,
        backgroundMusicUrl: this.backgroundMusicUrl,
        coverPrompt: replaceChildName(this.coverPrompt),
        defaultCoverUrl: this.defaultCoverUrl,
        sceneImageUrl: this.sceneImageUrl,
        reflectionQuestions: this.reflectionQuestions,
        estimatedDuration: this.estimatedDuration,
        isIllustrated: this.isIllustrated,
    };
    
    if (this.isIllustrated && this.pages && this.pages.length > 0) {
        // For illustrated stories, personalize each page
        result.pages = this.pages.map(page => ({
            pageNumber: page.pageNumber,
            backgroundUrl: page.backgroundUrl,
            characterPose: page.characterPose,
            characterPosition: page.characterPosition,
            showCharacter: page.showCharacter,
            textBoxes: page.textBoxes.map(tb => ({
                ...tb.toObject ? tb.toObject() : tb,
                text: replaceChildName(tb.text),
            })),
            ttsText: replaceChildName(page.ttsText),
            pageAudioUrl: page.pageAudioUrl,
            soundEffectUrl: page.soundEffectUrl,
        }));
        result.content = null; // No single content block for illustrated stories
    } else {
        // For text-based stories, use single content block
        result.content = replaceChildName(this.content);
        result.pages = null;
    }
    
    return result;
};

// Static method to find a random story matching criteria
devotionalStorySchema.statics.findRandomMatching = async function(options = {}) {
    const { ageGroup, goalTag, excludeIds = [], isIllustrated } = options;
    
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
    
    // Filter by story type if specified
    if (isIllustrated !== undefined) {
        query.isIllustrated = isIllustrated;
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
