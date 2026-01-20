const mongoose = require('mongoose');

/**
 * Donation Model
 * 
 * Tracks individual coin donations from kids to campaigns.
 * Stores a snapshot of campaign info for historical accuracy.
 */
const donationSchema = new mongoose.Schema({
    // Campaign reference
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DonationCampaign',
        required: true,
        index: true,
    },
    
    // User info
    userId: {
        type: String, // deviceId or email
        required: true,
        index: true,
    },
    kidProfileId: {
        type: String, // Which kid profile made the donation
    },
    kidName: {
        type: String, // Kid's display name (for leaderboards/display)
    },
    
    // Donation details
    amount: {
        type: Number,
        required: true,
        min: 1,
    },
    
    // Snapshot of campaign info (for historical accuracy)
    campaignTitle: {
        type: String,
        required: true,
    },
    campaignImage: {
        type: String,
    },
    
    // Which goal iteration this donation contributed to
    goalNumber: {
        type: Number,
        default: 1,
    },
    
    // Whether this donation completed a goal
    completedGoal: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Indexes for efficient queries
donationSchema.index({ campaignId: 1, createdAt: -1 });
donationSchema.index({ userId: 1, createdAt: -1 });
donationSchema.index({ kidProfileId: 1, createdAt: -1 });
donationSchema.index({ createdAt: -1 });

// Static method to get user's total donations
donationSchema.statics.getUserTotalDonations = async function(userId) {
    const result = await this.aggregate([
        { $match: { userId } },
        { $group: { _id: null, totalCoins: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    return result[0] || { totalCoins: 0, count: 0 };
};

// Static method to get user's goals completed
donationSchema.statics.getUserGoalsCompleted = async function(userId) {
    return await this.countDocuments({ userId, completedGoal: true });
};

// Static method to get top donors (for leaderboard)
donationSchema.statics.getTopDonors = async function(limit = 10) {
    return await this.aggregate([
        { $group: { 
            _id: '$userId', 
            kidName: { $first: '$kidName' },
            totalCoins: { $sum: '$amount' },
            donationCount: { $sum: 1 }
        }},
        { $sort: { totalCoins: -1 } },
        { $limit: limit }
    ]);
};

// Static method to get recent donations for a campaign
donationSchema.statics.getRecentForCampaign = async function(campaignId, limit = 10) {
    return await this.find({ campaignId })
        .select('kidName amount createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.model('Donation', donationSchema);
