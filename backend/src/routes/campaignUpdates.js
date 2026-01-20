const express = require('express');
const router = express.Router();
const CampaignUpdate = require('../models/CampaignUpdate');
const DonationCampaign = require('../models/DonationCampaign');

// Get all updates for a campaign (public)
router.get('/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { limit = 20, skip = 0 } = req.query;

        const updates = await CampaignUpdate.find({ 
            campaignId, 
            isActive: true 
        })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

        const total = await CampaignUpdate.countDocuments({ 
            campaignId, 
            isActive: true 
        });

        res.json({
            updates,
            total,
            hasMore: skip + updates.length < total
        });
    } catch (error) {
        console.error('Error fetching campaign updates:', error);
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

// Get all updates across all campaigns (for a feed view)
router.get('/feed', async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;

        const updates = await CampaignUpdate.find({ isActive: true })
            .populate('campaignId', 'title image')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await CampaignUpdate.countDocuments({ isActive: true });

        res.json({
            updates,
            total,
            hasMore: skip + updates.length < total
        });
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

// Get single update
router.get('/:id', async (req, res) => {
    try {
        const update = await CampaignUpdate.findById(req.params.id)
            .populate('campaignId', 'title image');
        
        if (!update) {
            return res.status(404).json({ error: 'Update not found' });
        }

        res.json(update);
    } catch (error) {
        console.error('Error fetching update:', error);
        res.status(500).json({ error: 'Failed to fetch update' });
    }
});

// Create new update (admin)
router.post('/', async (req, res) => {
    try {
        const { 
            campaignId, 
            type, 
            caption, 
            images, 
            videoUrl, 
            location, 
            itemsDonated,
            isPinned 
        } = req.body;

        // Verify campaign exists
        const campaign = await DonationCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const update = new CampaignUpdate({
            campaignId,
            type: type || 'photo',
            caption,
            images: images || [],
            videoUrl,
            location,
            itemsDonated: itemsDonated || 0,
            isPinned: isPinned || false,
            isActive: true
        });

        await update.save();

        res.status(201).json(update);
    } catch (error) {
        console.error('Error creating update:', error);
        res.status(500).json({ error: 'Failed to create update' });
    }
});

// Update an existing update (admin)
router.put('/:id', async (req, res) => {
    try {
        const update = await CampaignUpdate.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        if (!update) {
            return res.status(404).json({ error: 'Update not found' });
        }

        res.json(update);
    } catch (error) {
        console.error('Error updating:', error);
        res.status(500).json({ error: 'Failed to update' });
    }
});

// Delete update (admin)
router.delete('/:id', async (req, res) => {
    try {
        const update = await CampaignUpdate.findByIdAndDelete(req.params.id);
        
        if (!update) {
            return res.status(404).json({ error: 'Update not found' });
        }

        res.json({ success: true, message: 'Update deleted' });
    } catch (error) {
        console.error('Error deleting update:', error);
        res.status(500).json({ error: 'Failed to delete update' });
    }
});

// Like an update (public)
router.post('/:id/like', async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID required' });
        }

        const update = await CampaignUpdate.findById(req.params.id);
        
        if (!update) {
            return res.status(404).json({ error: 'Update not found' });
        }

        // Check if already liked
        const alreadyLiked = update.likedBy.includes(deviceId);
        
        if (alreadyLiked) {
            // Unlike
            update.likedBy = update.likedBy.filter(id => id !== deviceId);
            update.likes = Math.max(0, update.likes - 1);
        } else {
            // Like
            update.likedBy.push(deviceId);
            update.likes += 1;
        }

        await update.save();

        res.json({ 
            likes: update.likes, 
            liked: !alreadyLiked 
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

module.exports = router;
