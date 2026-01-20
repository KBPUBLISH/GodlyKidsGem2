const mongoose = require('mongoose');

/**
 * DonationCampaign Model
 * 
 * Represents a crowdfunding campaign where kids can donate Gold Coins
 * toward outreach items (socks, meals, etc.). Campaigns can be recurring
 * (reset when goal is reached) or one-off.
 * 
 * Future: Can be extended to support purchasable items (books, etc.)
 */
const donationCampaignSchema = new mongoose.Schema({
    // Basic info
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    image: {
        type: String, // URL to campaign image
    },
    
    // Goal tracking
    goalCoins: {
        type: Number,
        required: true,
        default: 500,
    },
    currentCoins: {
        type: Number,
        default: 0,
    },
    totalDonations: {
        type: Number,
        default: 0,
    },
    totalGoalsReached: {
        type: Number,
        default: 0,
    },
    
    // Campaign type
    isRecurring: {
        type: Boolean,
        default: true, // true = resets on goal, false = one-off
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    
    // Organization
    category: {
        type: String,
        enum: ['clothing', 'food', 'hygiene', 'shelter', 'education', 'other'],
        default: 'other',
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    
    // Future extensibility for purchasable items
    campaignType: {
        type: String,
        enum: ['outreach', 'purchase'],
        default: 'outreach',
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book', // For future book purchases
    },
    
    // Partner info (for display)
    partnerName: {
        type: String,
    },
    partnerLogo: {
        type: String,
    },
}, {
    timestamps: true,
});

// Index for efficient queries
donationCampaignSchema.index({ isActive: 1, sortOrder: 1 });
donationCampaignSchema.index({ category: 1, isActive: 1 });

// Virtual for progress percentage
donationCampaignSchema.virtual('progressPercent').get(function() {
    if (this.goalCoins === 0) return 0;
    return Math.min(100, Math.round((this.currentCoins / this.goalCoins) * 100));
});

// Method to add coins and check if goal is reached
donationCampaignSchema.methods.addCoins = async function(amount) {
    this.currentCoins += amount;
    this.totalDonations += 1;
    
    let goalReached = false;
    
    // Check if goal is reached
    if (this.currentCoins >= this.goalCoins) {
        goalReached = true;
        this.totalGoalsReached += 1;
        
        if (this.isRecurring) {
            // Reset for next round, keeping overflow
            this.currentCoins = this.currentCoins - this.goalCoins;
        } else {
            // One-off campaign - deactivate
            this.isActive = false;
        }
    }
    
    await this.save();
    return { goalReached, newTotal: this.currentCoins, totalGoalsReached: this.totalGoalsReached };
};

// Ensure virtuals are included in JSON
donationCampaignSchema.set('toJSON', { virtuals: true });
donationCampaignSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('DonationCampaign', donationCampaignSchema);
