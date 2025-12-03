const mongoose = require('mongoose');

// Schema for individual quiz questions
const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
    },
    options: [{
        text: {
            type: String,
            required: true,
        },
        isCorrect: {
            type: Boolean,
            default: false,
        },
    }],
});

// Schema for user quiz attempts
const attemptSchema = new mongoose.Schema({
    odlykids_user_id: {
        type: String,
        required: true,
    },
    attemptNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 2,
    },
    score: {
        type: Number,
        required: true,
    },
    coinsEarned: {
        type: Number,
        required: true,
    },
    completedAt: {
        type: Date,
        default: Date.now,
    },
});

// Main BookQuiz schema
const bookQuizSchema = new mongoose.Schema({
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        index: true,
    },
    // The generated quiz questions (6 questions)
    questions: [questionSchema],
    // Track attempts per user
    attempts: [attemptSchema],
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for efficient lookups
bookQuizSchema.index({ bookId: 1 });

// Helper method to get user's attempt count
bookQuizSchema.methods.getUserAttemptCount = function(userId) {
    return this.attempts.filter(a => a.godlykids_user_id === userId).length;
};

// Helper method to check if user can take quiz
bookQuizSchema.methods.canUserTakeQuiz = function(userId) {
    return this.getUserAttemptCount(userId) < 2;
};

// Helper method to add an attempt
bookQuizSchema.methods.addAttempt = function(userId, score, coinsEarned) {
    const attemptCount = this.getUserAttemptCount(userId);
    if (attemptCount >= 2) {
        throw new Error('Maximum attempts reached');
    }
    
    this.attempts.push({
        godlykids_user_id: userId,
        attemptNumber: attemptCount + 1,
        score,
        coinsEarned,
    });
    
    return attemptCount + 1;
};

// Update updatedAt on save
bookQuizSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BookQuiz', bookQuizSchema);

