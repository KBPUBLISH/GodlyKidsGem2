const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
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
    minAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    category: {
        type: String,
        default: 'Other',
    },
    categories: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    
    // Book type: standard (regular book) or kids_monthly (shown in Create Your Story / Kids Monthly Book picker)
    bookType: {
        type: String,
        enum: ['standard', 'kids_monthly'],
        default: 'standard',
    },
    
    // When bookType is kids_monthly, optional link to SavedCharacter (e.g. "Journey with Noah")
    featuredCharacterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavedCharacter',
        default: null,
    },
    
    // Book orientation - portrait (default) or landscape
    orientation: {
        type: String,
        enum: ['portrait', 'landscape'],
        default: 'portrait',
    },
    
    // Access control - whether content requires membership
    isMembersOnly: {
        type: Boolean,
        default: false,
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
    
    // Daily Session settings
    // Whether this book is available for daily session recommendations
    availableForDailySession: {
        type: Boolean,
        default: false,
    },
    
    // Whether this book should show the child's character on pages
    // When true, AI will analyze each page and place the character optimally
    showCharacterOverlay: {
        type: Boolean,
        default: false,
    },
    
    // Learning goal tags for daily session matching
    // Values: 'courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'
    goalTags: {
        type: [String],
        default: [],
    },
    
    // Global view count (incremented when a user opens the book)
    viewCount: {
        type: Number,
        default: 0,
    },
    // Total read sessions (opens); used for analytics
    totalReadSessions: {
        type: Number,
        default: 0,
    },
    // Global read count (incremented when any user completes the book)
    readCount: {
        type: Number,
        default: 0,
    },
    
    // Global favorite count
    favoriteCount: {
        type: Number,
        default: 0,
    },
    
    // Global like count (for top rated calculation)
    likeCount: {
        type: Number,
        default: 0,
    },
    
    // Organized file structure per book
    files: {
        type: {
            // Cover image (single)
            coverImage: {
                type: String, // URL to GCS: books/{bookId}/cover/filename
                default: null,
            },
            
            // Images collection (for book-level images)
            images: {
                type: [{
                    url: { type: String }, // URL to GCS: books/{bookId}/images/filename
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                }],
                default: [],
            },
            
            // Videos collection (for book-level videos)
            videos: {
                type: [{
                    url: { type: String }, // URL to GCS: books/{bookId}/videos/filename
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                }],
                default: [],
            },
            
            // Audio files collection (for book-level background music, max 3 tracks)
            audio: {
                type: [{
                    url: { type: String }, // URL to GCS: books/{bookId}/audio/filename
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                }],
                default: [],
            },
            // Index of which audio track is the main/default (0, 1, or 2). Used when reading; Create Your Story users can override.
            defaultAudioIndex: {
                type: Number,
                default: 0,
                min: 0,
                max: 2,
            },
        },
        default: () => ({
            coverImage: null,
            images: [],
            videos: [],
            audio: [],
            defaultAudioIndex: 0,
        }),
    },
    
    // Pages array - embedded pages for this book
    pages: {
        type: [{
            pageNumber: {
                type: Number,
                required: true,
            },
            
            // Page content - organized structure
            content: {
                // Text content on the page
                text: {
                    type: String,
                },
                
                // Text boxes with styling
                textBoxes: [{
                    text: String,
                    x: Number, // percentage (0-100)
                    y: Number, // percentage (0-100)
                    width: { type: Number, default: 30 }, // percentage (0-100)
                    alignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
                    fontFamily: { type: String, default: 'Comic Sans MS' },
                    fontSize: { type: Number, default: 24 },
                    color: { type: String, default: '#4a3b2a' },
                }],
            },
            
            // Page files - organized per page
            files: {
                // Background (image or video)
                background: {
                    url: { type: String }, // URL to GCS: books/{bookId}/pages/page-{pageNumber}.{ext}
                    type: { type: String, enum: ['image', 'video'] },
                },
                
                // Scroll overlay image
                scroll: {
                    url: { type: String }, // URL to GCS: books/{bookId}/scroll/filename
                    height: { type: Number }, // Height in px for scroll overlay
                },
                
                // Page-specific images
                images: [{
                    url: { type: String }, // URL to GCS: books/{bookId}/pages/images/filename
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                }],
                
                // Page-specific videos
                videos: [{
                    url: { type: String }, // URL to GCS: books/{bookId}/pages/videos/filename
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                }],
                
                // Audio narration for this page
                audio: {
                    url: { type: String }, // URL to GCS: books/{bookId}/audio/page-{pageNumber}.mp3
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                },
                
                // Sound effect for this page (1-3 seconds, plays on bubble tap)
                soundEffect: {
                    url: { type: String }, // URL to GCS: books/{bookId}/sound-effects/page-{pageNumber}.mp3
                    filename: { type: String },
                    uploadedAt: { type: Date, default: Date.now },
                },
            },
            
            // Character overlay settings (AI-determined or manual)
            // These are cached after first AI analysis to avoid repeated API calls
            characterOverlay: {
                // Whether to show character on this page (overrides book-level setting)
                showCharacter: { type: Boolean, default: true },
                // Pose to use (from user's generated poses)
                pose: { 
                    type: String, 
                    enum: ['standing_front', 'standing_happy', 'sitting', 'reading', 
                           'praying', 'walking', 'thinking', 'pointing', 'waving', 'celebrating', 'none'],
                    default: 'standing_front'
                },
                // Position as percentages (0-100)
                x: { type: Number, default: 75 },
                y: { type: Number, default: 70 },
                // Scale factor (0.5 to 2.0)
                scale: { type: Number, default: 1.0 },
                // Whether to flip character horizontally
                flipHorizontal: { type: Boolean, default: false },
                // AI reasoning for this placement (for debugging/review)
                reasoning: { type: String },
                // Whether this was set by AI or manually
                source: { type: String, enum: ['ai', 'manual'], default: 'ai' },
                // Timestamp of last AI analysis
                analyzedAt: { type: Date },
            },
            
            // Legacy fields (for backward compatibility)
            imageUrl: { type: String },
            audioUrl: { type: String },
            backgroundUrl: { type: String },
            backgroundType: { type: String, enum: ['image', 'video'] },
            scrollUrl: { type: String },
            scrollHeight: { type: Number },
            
            createdAt: {
                type: Date,
                default: Date.now,
            },
            updatedAt: {
                type: Date,
                default: Date.now,
            },
        }],
        default: [],
    },
    
    // Book-level text content
    text: {
        type: String, // Any book-level text content
    },
    
    // Associated games (array of game IDs)
    games: {
        type: [String], // Array of gameId values (e.g., ['prayer', 'challenge', 'strength'])
        default: [],
    },
    
    // Book-specific games (webview-based games that unlock after reading)
    bookGames: {
        type: [{
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            title: { type: String, required: true },
            url: { type: String, required: true },
            coverImage: { type: String }, // URL to cover image
            description: { type: String },
            createdAt: { type: Date, default: Date.now },
        }],
        default: [],
    },
    
    // Book-specific videos (MP4 videos that unlock after reading)
    bookVideos: {
        type: [{
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            title: { type: String, required: true },
            videoUrl: { type: String, required: true }, // URL to MP4 video file
            thumbnailUrl: { type: String }, // URL to thumbnail image
            description: { type: String },
            createdAt: { type: Date, default: Date.now },
        }],
        default: [],
    },
    
    // Intro video (studio logo animation) - plays before book starts
    introVideoUrl: {
        type: String,
        default: null,
    },
    
    // Default voice for this book - overrides user's selected voice while reading
    // This is the voiceId from the Voices collection (e.g., ElevenLabs voice ID)
    defaultVoiceId: {
        type: String,
        default: null,
    },
    
    // Reward voice - unlocked when user completes reading this book
    // This is the voiceId that gets added to user's unlockedVoices
    rewardVoiceId: {
        type: String,
        default: null,
    },
    
    // Default narrator voice for this book (optional)
    // If set, all non-character-tagged text uses this voice
    // If blank/null, user's selected voice is used for narration
    defaultNarratorVoiceId: {
        type: String,
        default: null,
    },
    
    // Character-to-voice mappings for @character tags in text boxes
    // When text starts with @CharacterName, that character's voice is used
    // Example: @Moses "Let my people go!" -> uses Moses's assigned voice
    characterVoices: {
        type: [{
            characterName: { type: String, required: true }, // e.g., "Moses", "Pharaoh", "God"
            voiceId: { type: String, required: true },       // ElevenLabs voice ID from Voices collection
            color: { type: String, default: null },          // Optional: text highlight color for this character
        }],
        default: [],
    },
    
    // AI-generated comment options for this book (cached)
    generatedComments: {
        type: [{
            text: { type: String, required: true },
            emoji: { type: String, required: true },
            color: { type: String, default: 'blue' },
        }],
        default: [],
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
bookSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

module.exports = mongoose.model('Book', bookSchema);
