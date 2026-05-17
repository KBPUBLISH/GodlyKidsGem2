const mongoose = require('mongoose');

// Page schema - organized as subfolder under each book
const pageSchema = new mongoose.Schema({
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        index: true, // Index for efficient queries by book
    },
    pageNumber: {
        type: Number,
        required: true,
    },

    // Page kind for swipe_up (vertical feed) reader layout.
    // - 'media': full-bleed image/video card (default; matches behavior of side_swipe pages)
    // - 'text':  text-forward card with optional background image/video for style
    // For side_swipe books this field is informational only and does not change rendering.
    pageKind: {
        type: String,
        enum: ['text', 'media'],
        default: 'media',
    },

    // For swipe_up Media pages with a video: auto-scroll to next page when video ends.
    // No effect on side_swipe books or text pages.
    videoAutoAdvance: {
        type: Boolean,
        default: false,
    },

    // Feature flags
    isColoringPage: {
        type: Boolean,
        default: false
    },
    // If true, coloring page only shows in end modal (not during reading)
    // If false, coloring page shows inline within the book
    coloringEndModalOnly: {
        type: Boolean,
        default: true // Default to end modal only
    },
    
    // Web View page - embeds external URL or game as interactive content
    isWebViewPage: {
        type: Boolean,
        default: false
    },
    webView: {
        // External URL to load in the web view
        url: { type: String },
        // OR reference to a game from the Games collection
        gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
        // Optional title to display in the overlay
        title: { type: String },
        // Whether to show the "Continue Reading" navigation button
        showNavigationButton: { type: Boolean, default: true },
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
            height: { type: Number }, // percentage (0-100) - optional, auto if not set
            alignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
            fontFamily: { type: String, default: 'Patrick Hand' }, // Google Font - works on iOS
            fontSize: { type: Number, default: 24 },
            color: { type: String, default: '#4a3b2a' },
            showBackground: { type: Boolean, default: false }, // Show semi-transparent background behind text
            backgroundColor: { type: String, default: 'rgba(255,255,255,0.85)' }, // Background color when showBackground is true
            shadowColor: { type: String, default: 'white' }, // Text shadow color: 'white', 'black', or custom
        }],
    },

    // Kids Monthly Book: optional prompt for on-demand background image generation (used when bookType is kids_monthly)
    sceneDescription: { type: String },
    // Kids Monthly Book: optional saved characters to reference on this page (e.g. Noah, David) for image generation
    referenceCharacterIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavedCharacter',
    }],

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

        // Page-specific videos (legacy - single videos)
        videos: [{
            url: { type: String }, // URL to GCS: books/{bookId}/pages/videos/filename
            filename: { type: String },
            uploadedAt: { type: Date, default: Date.now },
        }],
        
        // Video sequence - multiple videos that play in order
        videoSequence: [{
            url: { type: String, required: true }, // URL to GCS
            filename: { type: String },
            order: { type: Number, required: true }, // 1, 2, 3, etc.
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

    // Video sequence at root level (for easier access)
    videoSequence: [{
        url: { type: String, required: true },
        filename: { type: String },
        order: { type: Number, required: true },
        audioUrl: { type: String }, // Auto-extracted audio for this video (iOS audio layering)
        /** Optional playback trim relative to uploaded file (seconds) */
        trimStartSec: { type: Number },
        trimEndSec: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
    }],
    // Flag to use video sequence instead of single background video
    useVideoSequence: { type: Boolean, default: false },
    
    // Image sequence - multiple images that cycle with transitions
    imageSequence: [{
        url: { type: String, required: true },
        filename: { type: String },
        order: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
    }],
    // Flag to use image sequence instead of single background image
    useImageSequence: { type: Boolean, default: false },
    // Duration each image shows (in seconds)
    imageSequenceDuration: { type: Number, default: 3 },
    // Animation effect for image sequence: 'none', 'panLeft', 'panRight', 'panUp', 'panDown', 'zoomIn', 'zoomOut', 'kenBurns'
    imageSequenceAnimation: { type: String, default: 'kenBurns' },
    // Single background image animation (e.g. Kids Monthly generated pages): same options as image sequence
    backgroundImageAnimation: { type: String, default: 'kenBurns' },
    backgroundImageAnimationDuration: { type: Number, default: 10 },

    // Legacy fields (for backward compatibility)
    imageUrl: { type: String },
    audioUrl: { type: String },
    backgroundUrl: { type: String },
    backgroundType: { type: String, enum: ['image', 'video'] },
    scrollUrl: { type: String },
    scrollHeight: { type: Number },
    scrollMidHeight: { type: Number }, // Mid scroll height % (app uses this)
    scrollMaxHeight: { type: Number }, // Max scroll height %
    scrollOffsetY: { type: Number, default: 0 }, // Vertical offset from bottom in percentage (positive = higher)
    scrollOffsetX: { type: Number, default: 0 }, // Horizontal offset from center in percentage (positive = right)
    scrollWidth: { type: Number, default: 100 }, // Width of scroll as percentage (100 = full width)
    scrollOpacity: { type: Number, default: 100 }, // 0–100: transparency of scroll overlay (100 = opaque)
    soundEffectUrl: { type: String }, // URL for sound effect bubble audio
    /**
     * Optional trim for single background videos (ignored for images).
     * Seconds relative to uploaded file — readers clamp playback inside [start, end).
     */
    backgroundTrimStartSec: { type: Number },
    backgroundTrimEndSec: { type: Number },
    // Background audio - extracted from video or separate ambient audio that loops with the page
    // This plays as a separate <audio> element so it can layer with TTS (unlike video audio on iOS)
    backgroundAudioUrl: { type: String },
    // Legacy textBoxes at root level (portal sends here, new schema uses content.textBoxes)
    textBoxes: [{
        text: String,
        x: Number,
        y: Number,
        width: { type: Number, default: 30 },
        height: { type: Number }, // percentage (0-100) - optional, auto if not set
        alignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
        fontFamily: { type: String, default: 'Patrick Hand' }, // Google Font - works on iOS
        fontSize: { type: Number, default: 24 },
        color: { type: String, default: '#4a3b2a' },
    }],

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
pageSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

// Compound index to ensure unique page numbers per book
pageSchema.index({ bookId: 1, pageNumber: 1 }, { unique: true });

module.exports = mongoose.model('Page', pageSchema);
