const mongoose = require('mongoose');

const tutorialEventSchema = new mongoose.Schema({
    // User identification
    userId: {
        type: String,
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
    },
    
    // Tutorial step that was reached
    step: {
        type: String,
        required: true,
        enum: [
            'welcome_book_tap',
            'book_controls_intro',
            'book_swipe_intro',
            'book_swipe_1',
            'book_swipe_2',
            'book_swipe_3',
            'book_end_quiz',
            'quiz_in_progress',
            'coins_highlight',
            'coins_popup_open',
            'report_card_highlight',
            'report_card_open',
            'shop_highlight',
            'shop_open',
            'navigate_to_give',
            'campaign_highlight',
            'give_button_highlight',
            'donation_complete',
            'navigate_to_explore',
            'devotional_highlight',
            'navigate_to_books',
            'navigate_to_audio',
            'audiobook_highlight',
            'review_prompt',
            'tutorial_complete',
            'explore_pause',
            'paywall',
            'complete',
            'skipped',
        ],
    },
    
    // Step index for ordering
    stepIndex: {
        type: Number,
        default: 0,
    },
    
    // Additional metadata
    metadata: {
        platform: String,
        bookId: String,
        coinsEarned: Number,
        coinsDonated: Number,
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// Compound index for efficient queries
tutorialEventSchema.index({ step: 1, createdAt: -1 });
tutorialEventSchema.index({ userId: 1, sessionId: 1 });

module.exports = mongoose.model('TutorialEvent', tutorialEventSchema);
