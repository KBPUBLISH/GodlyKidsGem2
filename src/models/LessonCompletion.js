const mongoose = require('mongoose');

const lessonCompletionSchema = new mongoose.Schema({
    // Reference to lesson
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true,
        index: true,
    },
    
    // Reference to user (if you have user authentication)
    userId: {
        type: String, // Can be user ID or device ID
        required: true,
        index: true,
    },
    
    // Completion status
    completed: {
        type: Boolean,
        default: true,
    },
    
    // Completion data
    completedAt: {
        type: Date,
        default: Date.now,
    },
    
    // Activity response (for quiz or reflection)
    activityResponse: {
        // For quiz: selected option index
        selectedOption: {
            type: Number,
        },
        // For reflection: user's reflection text
        reflectionText: {
            type: String,
        },
    },
    
    // Reward claimed
    coinsAwarded: {
        type: Number,
        default: 0,
    },
    
    // Progress tracking
    progress: {
        videoWatched: {
            type: Boolean,
            default: false,
        },
        devotionalRead: {
            type: Boolean,
            default: false,
        },
        activityCompleted: {
            type: Boolean,
            default: false,
        },
    },
});

// Compound index to ensure one completion per lesson per user
lessonCompletionSchema.index({ lessonId: 1, userId: 1 }, { unique: true });

// Index for querying user completions
lessonCompletionSchema.index({ userId: 1, completedAt: -1 });

module.exports = mongoose.model('LessonCompletion', lessonCompletionSchema);



