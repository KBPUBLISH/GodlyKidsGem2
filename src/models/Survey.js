const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
    // User identification
    userId: {
        type: String,
        required: true,
        index: true,
    },
    email: {
        type: String,
        index: true,
    },
    
    // Survey type
    surveyType: {
        type: String,
        enum: ['weekly_feedback', 'nps', 'feature_request', 'exit_survey', 'layout_rating'],
        default: 'weekly_feedback',
    },
    
    // Layout rating (1-5, for surveyType: 'layout_rating')
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    
    // Content preference questions (multi-select)
    wantsMoreGames: {
        type: Boolean,
        default: false,
    },
    wantsMoreBooks: {
        type: Boolean,
        default: false,
    },
    wantsMoreAudioDramas: {
        type: Boolean,
        default: false,
    },
    wantsMoreLessons: {
        type: Boolean,
        default: false,
    },
    wantsMoreSongs: {
        type: Boolean,
        default: false,
    },
    
    // NPS Score (1-10 scale for referral likelihood)
    npsScore: {
        type: Number,
        min: 1,
        max: 10,
    },
    
    // Custom feedback
    customFeedback: {
        type: String,
        maxlength: 2000,
    },
    
    // Additional metadata
    metadata: {
        platform: String,          // 'ios', 'android', 'web'
        appVersion: String,
        daysUsingApp: Number,      // How many days since first use
        subscriptionStatus: String, // 'free', 'trial', 'active'
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// Indexes for analytics queries
surveyResponseSchema.index({ surveyType: 1, createdAt: -1 });
surveyResponseSchema.index({ npsScore: 1 });
surveyResponseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
