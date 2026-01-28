const mongoose = require('mongoose');

const onboardingEventSchema = new mongoose.Schema({
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
    
    // Event details
    event: {
        type: String,
        required: true,
        enum: [
            // Splash page events
            'splash_page_viewed',
            'splash_explore_clicked',
            'splash_signin_clicked',
            
            // Interest/Subject selection events
            'interests_selected',
            'interests_skipped',
            'subjects_selected',
            'subjects_skipped',
            
            // Godly Kids Time (Daily Session) events
            'learning_goal_selected',
            'godly_kids_time_started',
            'godly_kids_time_prayer_completed',
            'godly_kids_time_devotional_completed',
            'godly_kids_time_book_completed',
            'godly_kids_time_completed',
            'godly_kids_time_exited',
            
            // Onboarding flow events
            'onboarding_started',
            'step_1_complete',      // Parent profile
            'step_2_complete',      // Family/kids
            'step_3_complete',      // Discipleship goals
            'step_4_complete',      // Feature interests
            'step_5_complete',      // Voice selection
            'step_6_complete',      // Account creation
            'onboarding_complete',
            
            // Account events
            'create_account_clicked',
            'account_created',
            
            // Paywall events
            'step_4_viewed',        // Paywall viewed (legacy)
            'paywall_viewed',       // Paywall shown
            'paywall_shown',        // Alias for paywall_viewed
            'paywall_exit',         // User closed paywall
            'paywall_closed',       // Alias for paywall_exit
            'paywall_trial_clicked',
            'paywall_account_required',
            'paywall_parent_gate_shown',
            'paywall_parent_gate_passed',
            'paywall_purchase_started',
            'paywall_purchase_error',
            'paywall_purchase_cancelled',
            
            // Subscription events
            'plan_selected',        // User selected a plan
            'subscribe_clicked',
            'subscription_started',
            'subscribed',           // User completed subscription/purchase
            'trial_started',
            'restore_clicked',
            'restore_success',
            'skip_clicked',         // User skipped paywall
        ],
    },
    
    // Additional data
    metadata: {
        step: Number,
        planType: String,           // 'annual' | 'monthly' | 'lifetime'
        kidsCount: Number,
        voiceSelected: String,
        priorities: [String],       // Discipleship goals selected
        features: [String],         // Feature interests selected
        interests: [String],        // Interest categories selected (bedtime, bible-stories, etc)
        subjects: [String],         // Curriculum subjects selected (bible, history, etc)
        count: Number,              // Count of selections
        email: String,              // Email for account creation
        platform: String,
        referrer: String,
        error: String,              // Error message for purchase errors
        // Godly Kids Time session data
        goal: String,               // Learning goal selected (learn, grow, bond, relax)
        totalCoins: Number,         // Total coins earned in session
        stepsCompleted: Number,     // Number of steps completed
        duration: Number,           // Session duration in seconds/minutes
        coinsEarned: Number,        // Coins earned for a specific step
        stepType: String,           // Type of step (prayer, devotional, book)
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// Compound index for efficient queries
onboardingEventSchema.index({ event: 1, createdAt: -1 });
onboardingEventSchema.index({ userId: 1, sessionId: 1 });

module.exports = mongoose.model('OnboardingEvent', onboardingEventSchema);

