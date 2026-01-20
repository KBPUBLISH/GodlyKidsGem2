const express = require('express');
const router = express.Router();
const DonationCampaign = require('../models/DonationCampaign');

/**
 * Campaign Routes
 * 
 * Manages donation campaigns for the crowdfunding feature
 */

// GET /api/campaigns - List active campaigns (for app)
router.get('/', async (req, res) => {
    try {
        console.log('📦 Fetching active campaigns...');
        const campaigns = await DonationCampaign.find({ isActive: true })
            .select('-__v')
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();
        
        console.log(`📦 Found ${campaigns.length} active campaigns`);
        
        // Add progress percentage
        const campaignsWithProgress = campaigns.map(c => ({
            ...c,
            progressPercent: c.goalCoins > 0 
                ? Math.min(100, Math.round((c.currentCoins / c.goalCoins) * 100))
                : 0
        }));
        
        res.json(campaignsWithProgress);
    } catch (error) {
        console.error('❌ Error fetching campaigns:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
});

// GET /api/campaigns/all - List all campaigns (for portal)
router.get('/all', async (req, res) => {
    try {
        const campaigns = await DonationCampaign.find({})
            .select('-__v')
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();
        
        const campaignsWithProgress = campaigns.map(c => ({
            ...c,
            progressPercent: c.goalCoins > 0 
                ? Math.min(100, Math.round((c.currentCoins / c.goalCoins) * 100))
                : 0
        }));
        
        res.json(campaignsWithProgress);
    } catch (error) {
        console.error('Error fetching all campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', async (req, res) => {
    try {
        const campaign = await DonationCampaign.findById(req.params.id).lean();
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        campaign.progressPercent = campaign.goalCoins > 0 
            ? Math.min(100, Math.round((campaign.currentCoins / campaign.goalCoins) * 100))
            : 0;
        
        res.json(campaign);
    } catch (error) {
        console.error('Error fetching campaign:', error);
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
});

// POST /api/campaigns - Create new campaign (portal)
router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            image,
            goalCoins,
            isRecurring,
            isActive,
            category,
            sortOrder,
            partnerName,
            partnerLogo,
        } = req.body;
        
        const campaign = new DonationCampaign({
            title,
            description,
            image,
            goalCoins: goalCoins || 500,
            isRecurring: isRecurring !== false, // Default true
            isActive: isActive !== false, // Default true
            category: category || 'other',
            sortOrder: sortOrder || 0,
            partnerName,
            partnerLogo,
        });
        
        await campaign.save();
        console.log(`📦 Created campaign: ${title}`);
        
        res.status(201).json(campaign);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// PUT /api/campaigns/:id - Update campaign (portal)
router.put('/:id', async (req, res) => {
    try {
        const {
            title,
            description,
            image,
            goalCoins,
            isRecurring,
            isActive,
            category,
            sortOrder,
            partnerName,
            partnerLogo,
            currentCoins, // Allow manual reset
        } = req.body;
        
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (image !== undefined) updateData.image = image;
        if (goalCoins !== undefined) updateData.goalCoins = goalCoins;
        if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (category !== undefined) updateData.category = category;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
        if (partnerName !== undefined) updateData.partnerName = partnerName;
        if (partnerLogo !== undefined) updateData.partnerLogo = partnerLogo;
        if (currentCoins !== undefined) updateData.currentCoins = currentCoins;
        
        const campaign = await DonationCampaign.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        console.log(`📦 Updated campaign: ${campaign.title}`);
        res.json(campaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

// DELETE /api/campaigns/:id - Delete campaign (portal)
router.delete('/:id', async (req, res) => {
    try {
        const campaign = await DonationCampaign.findByIdAndDelete(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        console.log(`🗑️ Deleted campaign: ${campaign.title}`);
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

// POST /api/campaigns/:id/reset - Manually reset a campaign (portal)
router.post('/:id/reset', async (req, res) => {
    try {
        const campaign = await DonationCampaign.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        campaign.currentCoins = 0;
        await campaign.save();
        
        console.log(`🔄 Reset campaign: ${campaign.title}`);
        res.json(campaign);
    } catch (error) {
        console.error('Error resetting campaign:', error);
        res.status(500).json({ error: 'Failed to reset campaign' });
    }
});

// GET /api/campaigns/stats/summary - Get overall stats (portal)
router.get('/stats/summary', async (req, res) => {
    try {
        const totalCampaigns = await DonationCampaign.countDocuments();
        const activeCampaigns = await DonationCampaign.countDocuments({ isActive: true });
        
        const stats = await DonationCampaign.aggregate([
            {
                $group: {
                    _id: null,
                    totalGoalsReached: { $sum: '$totalGoalsReached' },
                    totalDonations: { $sum: '$totalDonations' },
                }
            }
        ]);
        
        res.json({
            totalCampaigns,
            activeCampaigns,
            totalGoalsReached: stats[0]?.totalGoalsReached || 0,
            totalDonations: stats[0]?.totalDonations || 0,
        });
    } catch (error) {
        console.error('Error fetching campaign stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
