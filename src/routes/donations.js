const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const DonationCampaign = require('../models/DonationCampaign');

/**
 * Donation Routes
 * 
 * Handles coin donations from kids to campaigns
 */

// POST /api/donations - Submit a donation
router.post('/', async (req, res) => {
    try {
        const {
            campaignId,
            userId,
            kidProfileId,
            kidName,
            amount,
        } = req.body;
        
        // Validate required fields
        if (!campaignId || !userId || !amount) {
            return res.status(400).json({ 
                error: 'Missing required fields: campaignId, userId, amount' 
            });
        }
        
        if (amount < 1) {
            return res.status(400).json({ error: 'Donation amount must be at least 1' });
        }
        
        // Find the campaign
        const campaign = await DonationCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        if (!campaign.isActive) {
            return res.status(400).json({ error: 'Campaign is no longer active' });
        }
        
        // Get current goal number before adding coins
        const currentGoalNumber = campaign.totalGoalsReached + 1;
        
        // Add coins to campaign and check if goal reached
        const { goalReached, newTotal, totalGoalsReached } = await campaign.addCoins(amount);
        
        // Create donation record
        const donation = new Donation({
            campaignId,
            userId,
            kidProfileId,
            kidName: kidName || 'Anonymous',
            amount,
            campaignTitle: campaign.title,
            campaignImage: campaign.image,
            goalNumber: currentGoalNumber,
            completedGoal: goalReached,
        });
        
        await donation.save();
        
        console.log(`💰 Donation: ${kidName || userId} gave ${amount} coins to "${campaign.title}" (${newTotal}/${campaign.goalCoins})${goalReached ? ' - GOAL REACHED!' : ''}`);
        
        res.status(201).json({
            success: true,
            donation,
            campaign: {
                _id: campaign._id,
                title: campaign.title,
                currentCoins: newTotal,
                goalCoins: campaign.goalCoins,
                progressPercent: Math.min(100, Math.round((newTotal / campaign.goalCoins) * 100)),
                totalGoalsReached,
            },
            goalReached,
            message: goalReached 
                ? `Amazing! You helped complete goal #${totalGoalsReached}!` 
                : `Thank you for donating ${amount} coins!`,
        });
    } catch (error) {
        console.error('Error processing donation:', error);
        res.status(500).json({ error: 'Failed to process donation' });
    }
});

// GET /api/donations/user/:userId - Get user's donation history
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;
        
        const donations = await Donation.find({ userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        
        // Get user totals
        const totals = await Donation.getUserTotalDonations(userId);
        const goalsCompleted = await Donation.getUserGoalsCompleted(userId);
        
        res.json({
            donations,
            totals: {
                totalCoins: totals.totalCoins,
                donationCount: totals.count,
                goalsCompleted,
            }
        });
    } catch (error) {
        console.error('Error fetching user donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// GET /api/donations/kid/:kidProfileId - Get specific kid's donation history
router.get('/kid/:kidProfileId', async (req, res) => {
    try {
        const { kidProfileId } = req.params;
        const { limit = 50 } = req.query;
        
        const donations = await Donation.find({ kidProfileId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        
        // Get kid totals
        const totals = await Donation.aggregate([
            { $match: { kidProfileId } },
            { $group: { 
                _id: null, 
                totalCoins: { $sum: '$amount' }, 
                count: { $sum: 1 },
                goalsCompleted: { $sum: { $cond: ['$completedGoal', 1, 0] } }
            }}
        ]);
        
        res.json({
            donations,
            totals: totals[0] || { totalCoins: 0, count: 0, goalsCompleted: 0 }
        });
    } catch (error) {
        console.error('Error fetching kid donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// GET /api/donations/campaign/:campaignId - Get donations for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { limit = 50 } = req.query;
        
        const donations = await Donation.find({ campaignId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        
        res.json(donations);
    } catch (error) {
        console.error('Error fetching campaign donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// GET /api/donations/campaign/:campaignId/recent - Get recent donors (for display)
router.get('/campaign/:campaignId/recent', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { limit = 5 } = req.query;
        
        const recentDonors = await Donation.getRecentForCampaign(campaignId, parseInt(limit));
        
        res.json(recentDonors);
    } catch (error) {
        console.error('Error fetching recent donors:', error);
        res.status(500).json({ error: 'Failed to fetch recent donors' });
    }
});

// GET /api/donations/leaderboard - Get top donors
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const topDonors = await Donation.getTopDonors(parseInt(limit));
        
        res.json(topDonors);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// GET /api/donations/stats - Get overall donation stats
router.get('/stats', async (req, res) => {
    try {
        const totalDonations = await Donation.countDocuments();
        
        const totals = await Donation.aggregate([
            { $group: { 
                _id: null, 
                totalCoins: { $sum: '$amount' },
                goalsCompleted: { $sum: { $cond: ['$completedGoal', 1, 0] } }
            }}
        ]);
        
        const uniqueDonors = await Donation.distinct('userId');
        
        res.json({
            totalDonations,
            totalCoins: totals[0]?.totalCoins || 0,
            goalsCompleted: totals[0]?.goalsCompleted || 0,
            uniqueDonors: uniqueDonors.length,
        });
    } catch (error) {
        console.error('Error fetching donation stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
