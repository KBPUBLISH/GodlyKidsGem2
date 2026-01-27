const express = require('express');
const router = express.Router();
const HubPlaylist = require('../models/HubPlaylist');
const Creator = require('../models/Creator');
const AppUser = require('../models/AppUser');
const { authenticateCreator } = require('./creatorAuth');
const { authenticateAdmin } = require('../middleware/auth');

// ==================== PUBLIC ROUTES (for app) ====================

// GET /api/hub/playlists - Browse published hub content
router.get('/playlists', async (req, res) => {
    try {
        const { 
            category, 
            type, 
            featured,
            sort = 'newest',
            limit = 20, 
            offset = 0 
        } = req.query;
        
        const query = { status: 'published' };
        
        if (category) {
            query.categories = category;
        }
        if (type) {
            query.type = type;
        }
        if (featured === 'true') {
            query.isFeatured = true;
        }
        
        let sortOption = { publishedAt: -1 }; // Default: newest
        if (sort === 'popular') {
            sortOption = { purchaseCount: -1 };
        } else if (sort === 'price_low') {
            sortOption = { priceTokens: 1 };
        } else if (sort === 'price_high') {
            sortOption = { priceTokens: -1 };
        }
        
        const playlists = await HubPlaylist.find(query)
            .populate('creatorId', 'name profileImage')
            .sort(sortOption)
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();
        
        const total = await HubPlaylist.countDocuments(query);
        
        res.json({
            playlists,
            total,
            hasMore: (parseInt(offset) + playlists.length) < total,
        });
    } catch (error) {
        console.error('Get hub playlists error:', error);
        res.status(500).json({ error: 'Failed to get playlists' });
    }
});

// GET /api/hub/playlists/:id - Get single playlist details
router.get('/playlists/:id', async (req, res) => {
    try {
        const playlist = await HubPlaylist.findById(req.params.id)
            .populate('creatorId', 'name profileImage bio website')
            .lean();
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Only show published content publicly
        if (playlist.status !== 'published') {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Increment view count
        await HubPlaylist.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
        
        res.json({ playlist });
    } catch (error) {
        console.error('Get hub playlist error:', error);
        res.status(500).json({ error: 'Failed to get playlist' });
    }
});

// GET /api/hub/creators/:id - Get creator public profile
router.get('/creators/:id', async (req, res) => {
    try {
        const creator = await Creator.findById(req.params.id)
            .select('name bio profileImage website')
            .lean();
        
        if (!creator || creator.status === 'suspended') {
            return res.status(404).json({ error: 'Creator not found' });
        }
        
        // Get their published content
        const playlists = await HubPlaylist.find({ 
            creatorId: req.params.id,
            status: 'published'
        })
        .sort({ publishedAt: -1 })
        .lean();
        
        res.json({
            creator,
            playlists,
            contentCount: playlists.length,
        });
    } catch (error) {
        console.error('Get creator profile error:', error);
        res.status(500).json({ error: 'Failed to get creator' });
    }
});

// GET /api/hub/featured - Get featured hub content
router.get('/featured', async (req, res) => {
    try {
        const playlists = await HubPlaylist.find({ 
            status: 'published',
            isFeatured: true
        })
        .populate('creatorId', 'name profileImage')
        .sort({ featuredOrder: 1 })
        .limit(10)
        .lean();
        
        res.json({ playlists });
    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({ error: 'Failed to get featured content' });
    }
});

// ==================== CREATOR ROUTES ====================

// GET /api/hub/my-playlists - Get creator's own playlists
router.get('/my-playlists', authenticateCreator, async (req, res) => {
    try {
        const { status } = req.query;
        
        const query = { creatorId: req.creator._id };
        if (status) {
            query.status = status;
        }
        
        const playlists = await HubPlaylist.find(query)
            .sort({ updatedAt: -1 })
            .lean();
        
        res.json({ playlists });
    } catch (error) {
        console.error('Get my playlists error:', error);
        res.status(500).json({ error: 'Failed to get playlists' });
    }
});

// POST /api/hub/my-playlists - Create new playlist (draft)
router.post('/my-playlists', authenticateCreator, async (req, res) => {
    try {
        const { title, description, type, priceTokens, priceUSD, usdPurchaseEnabled, coverImage, categories, minAge, items } = req.body;
        
        if (!title || !priceTokens) {
            return res.status(400).json({ error: 'Title and price are required' });
        }
        
        if (priceTokens < 1 || priceTokens > 500) {
            return res.status(400).json({ error: 'Price must be between 1 and 500 tokens' });
        }
        
        // Validate USD price if enabled
        if (usdPurchaseEnabled && (!priceUSD || priceUSD < 0.99 || priceUSD > 99.99)) {
            return res.status(400).json({ error: 'USD price must be between $0.99 and $99.99' });
        }
        
        const playlist = new HubPlaylist({
            creatorId: req.creator._id,
            title,
            author: req.creator.name,
            description,
            type: type || 'Audiobook',
            priceTokens,
            priceUSD: usdPurchaseEnabled ? priceUSD : null,
            usdPurchaseEnabled: usdPurchaseEnabled || false,
            coverImage,
            categories: categories || ['Godly Hub'],
            minAge,
            items: items || [],
            status: 'draft',
        });
        
        await playlist.save();
        
        // Update creator content count
        await Creator.findByIdAndUpdate(req.creator._id, { $inc: { totalContentCount: 1 } });
        
        res.status(201).json({
            message: 'Playlist created',
            playlist,
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// GET /api/hub/my-playlists/:id - Get single playlist (creator's own)
router.get('/my-playlists/:id', authenticateCreator, async (req, res) => {
    try {
        const playlist = await HubPlaylist.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        }).lean();
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        res.json({ playlist });
    } catch (error) {
        console.error('Get my playlist error:', error);
        res.status(500).json({ error: 'Failed to get playlist' });
    }
});

// PUT /api/hub/my-playlists/:id - Update playlist
router.put('/my-playlists/:id', authenticateCreator, async (req, res) => {
    try {
        const playlist = await HubPlaylist.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Can't edit published playlists (need to contact admin)
        if (playlist.status === 'published') {
            return res.status(400).json({ 
                error: 'Cannot edit published content. Please contact support to make changes.' 
            });
        }
        
        const { title, description, type, priceTokens, priceUSD, usdPurchaseEnabled, coverImage, categories, minAge, items } = req.body;
        
        if (title) playlist.title = title;
        if (description !== undefined) playlist.description = description;
        if (type) playlist.type = type;
        if (priceTokens) {
            if (priceTokens < 1 || priceTokens > 500) {
                return res.status(400).json({ error: 'Price must be between 1 and 500 tokens' });
            }
            playlist.priceTokens = priceTokens;
        }
        // Handle USD pricing
        if (usdPurchaseEnabled !== undefined) {
            playlist.usdPurchaseEnabled = usdPurchaseEnabled;
            if (usdPurchaseEnabled) {
                if (!priceUSD || priceUSD < 0.99 || priceUSD > 99.99) {
                    return res.status(400).json({ error: 'USD price must be between $0.99 and $99.99' });
                }
                playlist.priceUSD = priceUSD;
            } else {
                playlist.priceUSD = null;
            }
        } else if (priceUSD !== undefined) {
            playlist.priceUSD = priceUSD;
        }
        if (coverImage) playlist.coverImage = coverImage;
        if (categories) playlist.categories = categories;
        if (minAge !== undefined) playlist.minAge = minAge;
        if (items) playlist.items = items;
        
        // If was rejected, reset to draft
        if (playlist.status === 'rejected') {
            playlist.status = 'draft';
            playlist.reviewNotes = undefined;
        }
        
        await playlist.save();
        
        res.json({
            message: 'Playlist updated',
            playlist,
        });
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ error: 'Failed to update playlist' });
    }
});

// POST /api/hub/my-playlists/:id/submit - Submit for review
router.post('/my-playlists/:id/submit', authenticateCreator, async (req, res) => {
    try {
        const playlist = await HubPlaylist.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        if (playlist.status !== 'draft' && playlist.status !== 'rejected') {
            return res.status(400).json({ error: 'Only draft or rejected playlists can be submitted' });
        }
        
        // Validate playlist has content
        if (!playlist.items || playlist.items.length === 0) {
            return res.status(400).json({ error: 'Playlist must have at least one episode/song' });
        }
        
        // Check all items have audio
        const missingAudio = playlist.items.some(item => !item.audioUrl);
        if (missingAudio) {
            return res.status(400).json({ error: 'All episodes/songs must have audio files' });
        }
        
        playlist.status = 'pending_review';
        playlist.submittedAt = new Date();
        playlist.reviewNotes = undefined;
        
        await playlist.save();
        
        console.log(`📝 Hub playlist submitted for review: "${playlist.title}" by ${req.creator.name}`);
        
        res.json({
            message: 'Playlist submitted for review',
            playlist,
        });
    } catch (error) {
        console.error('Submit playlist error:', error);
        res.status(500).json({ error: 'Failed to submit playlist' });
    }
});

// DELETE /api/hub/my-playlists/:id - Delete draft playlist
router.delete('/my-playlists/:id', authenticateCreator, async (req, res) => {
    try {
        const playlist = await HubPlaylist.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        if (playlist.status === 'published') {
            return res.status(400).json({ 
                error: 'Cannot delete published content. Please contact support.' 
            });
        }
        
        await HubPlaylist.findByIdAndDelete(req.params.id);
        
        // Update creator content count
        await Creator.findByIdAndUpdate(req.creator._id, { $inc: { totalContentCount: -1 } });
        
        res.json({ message: 'Playlist deleted' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

// GET /api/hub/my-earnings - Get creator's earnings summary
router.get('/my-earnings', authenticateCreator, async (req, res) => {
    try {
        const creator = req.creator;
        
        // Get recent transactions for this creator
        const TokenTransaction = require('../models/TokenTransaction');
        const recentSales = await TokenTransaction.find({
            relatedCreatorId: creator._id,
            type: 'spend',
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('relatedPlaylistId', 'title')
        .lean();
        
        // Get sales by playlist
        const salesByPlaylist = await HubPlaylist.find({ creatorId: creator._id })
            .select('title purchaseCount totalTokensEarned')
            .sort({ purchaseCount: -1 })
            .lean();
        
        res.json({
            totalEarningsCents: creator.totalEarningsCents || 0,
            pendingPayoutCents: creator.pendingPayoutCents || 0,
            totalPaidOutCents: creator.totalPaidOutCents || 0,
            totalSalesCount: creator.totalSalesCount || 0,
            recentSales,
            salesByPlaylist,
        });
    } catch (error) {
        console.error('Get earnings error:', error);
        res.status(500).json({ error: 'Failed to get earnings' });
    }
});

// ==================== ADMIN ROUTES ====================

// GET /api/hub/admin/creators - List all creators
router.get('/admin/creators', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        
        const query = {};
        if (status) query.status = status;
        
        const creators = await Creator.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
        
        res.json({ creators });
    } catch (error) {
        console.error('Get creators error:', error);
        res.status(500).json({ error: 'Failed to get creators' });
    }
});

// POST /api/hub/admin/creators/invite - Invite a new creator
router.post('/admin/creators/invite', authenticateAdmin, async (req, res) => {
    try {
        const { email, name } = req.body;
        
        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name are required' });
        }
        
        // Check if already exists
        const existing = await Creator.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'A creator with this email already exists' });
        }
        
        const inviteToken = Creator.generateInviteToken();
        
        const creator = new Creator({
            email: email.toLowerCase(),
            name,
            status: 'invited',
            inviteToken,
            invitedAt: new Date(),
            invitedBy: req.user?.email || 'admin',
        });
        
        await creator.save();
        
        // Generate invite URL
        const inviteUrl = `https://portal.godlykids.com/creator/accept-invite?token=${inviteToken}`;
        
        console.log(`📧 Creator invite sent to ${email}: ${inviteUrl}`);
        
        // TODO: Send invite email
        
        res.status(201).json({
            message: 'Creator invited',
            creator: {
                id: creator._id,
                email: creator.email,
                name: creator.name,
                status: creator.status,
            },
            inviteUrl,
            inviteToken,
        });
    } catch (error) {
        console.error('Invite creator error:', error);
        res.status(500).json({ 
            error: 'Failed to invite creator',
            details: error.message,
            code: error.code
        });
    }
});

// PUT /api/hub/admin/creators/:id/status - Update creator status
router.put('/admin/creators/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const creator = await Creator.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).select('-password');
        
        if (!creator) {
            return res.status(404).json({ error: 'Creator not found' });
        }
        
        res.json({
            message: `Creator ${status === 'suspended' ? 'suspended' : 'activated'}`,
            creator,
        });
    } catch (error) {
        console.error('Update creator status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// GET /api/hub/admin/pending - Get playlists pending review
router.get('/admin/pending', authenticateAdmin, async (req, res) => {
    try {
        const playlists = await HubPlaylist.find({ status: 'pending_review' })
            .populate('creatorId', 'name email profileImage')
            .sort({ submittedAt: 1 }) // Oldest first
            .lean();
        
        res.json({ playlists });
    } catch (error) {
        console.error('Get pending error:', error);
        res.status(500).json({ error: 'Failed to get pending playlists' });
    }
});

// PUT /api/hub/admin/playlists/:id/review - Approve or reject playlist
router.put('/admin/playlists/:id/review', authenticateAdmin, async (req, res) => {
    try {
        const { action, notes } = req.body;
        
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject' });
        }
        
        const playlist = await HubPlaylist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        if (playlist.status !== 'pending_review') {
            return res.status(400).json({ error: 'Playlist is not pending review' });
        }
        
        playlist.reviewedAt = new Date();
        playlist.reviewedBy = req.user?.email || 'admin';
        
        if (action === 'approve') {
            playlist.status = 'published';
            playlist.publishedAt = new Date();
            console.log(`✅ Hub playlist approved: "${playlist.title}"`);
        } else {
            playlist.status = 'rejected';
            playlist.reviewNotes = notes || 'Content does not meet our guidelines';
            console.log(`❌ Hub playlist rejected: "${playlist.title}" - ${playlist.reviewNotes}`);
        }
        
        await playlist.save();
        
        res.json({
            message: `Playlist ${action === 'approve' ? 'approved' : 'rejected'}`,
            playlist,
        });
    } catch (error) {
        console.error('Review playlist error:', error);
        res.status(500).json({ error: 'Failed to review playlist' });
    }
});

// GET /api/hub/admin/earnings - Get earnings report
router.get('/admin/earnings', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Get all creators with earnings
        const creators = await Creator.find({ totalEarningsCents: { $gt: 0 } })
            .select('name email totalEarningsCents pendingPayoutCents totalPaidOutCents totalSalesCount')
            .sort({ totalEarningsCents: -1 })
            .lean();
        
        // Get token purchase stats
        const TokenPurchase = require('../models/TokenPurchase');
        const purchaseStats = await TokenPurchase.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: null,
                    totalRevenueCents: { $sum: '$priceCents' },
                    totalTokensSold: { $sum: '$tokenAmount' },
                    purchaseCount: { $sum: 1 },
                }
            }
        ]);
        
        // Get token spending stats
        const TokenTransaction = require('../models/TokenTransaction');
        const spendStats = await TokenTransaction.aggregate([
            { $match: { type: 'spend' } },
            {
                $group: {
                    _id: null,
                    totalTokensSpent: { $sum: { $abs: '$amount' } },
                    totalCreatorEarnings: { $sum: '$creatorEarningsCents' },
                    transactionCount: { $sum: 1 },
                }
            }
        ]);
        
        res.json({
            creators,
            tokenSales: purchaseStats[0] || { totalRevenueCents: 0, totalTokensSold: 0, purchaseCount: 0 },
            contentSales: spendStats[0] || { totalTokensSpent: 0, totalCreatorEarnings: 0, transactionCount: 0 },
            totalPendingPayouts: creators.reduce((sum, c) => sum + (c.pendingPayoutCents || 0), 0),
        });
    } catch (error) {
        console.error('Get earnings report error:', error);
        res.status(500).json({ error: 'Failed to get earnings report' });
    }
});

// POST /api/hub/admin/payouts/:creatorId - Record a payout
router.post('/admin/payouts/:creatorId', authenticateAdmin, async (req, res) => {
    try {
        const { amountCents, method, transactionReference, notes } = req.body;
        
        if (!amountCents || !method) {
            return res.status(400).json({ error: 'Amount and method are required' });
        }
        
        const creator = await Creator.findById(req.params.creatorId);
        if (!creator) {
            return res.status(404).json({ error: 'Creator not found' });
        }
        
        if (amountCents > creator.pendingPayoutCents) {
            return res.status(400).json({ 
                error: 'Amount exceeds pending payout',
                pending: creator.pendingPayoutCents,
            });
        }
        
        // Record payout
        const CreatorPayout = require('../models/CreatorPayout');
        const payout = new CreatorPayout({
            creatorId: creator._id,
            amountCents,
            method,
            transactionReference,
            notes,
            status: 'completed',
            processedBy: req.user?.email || 'admin',
            processedAt: new Date(),
        });
        await payout.save();
        
        // Update creator balances
        creator.pendingPayoutCents -= amountCents;
        creator.totalPaidOutCents = (creator.totalPaidOutCents || 0) + amountCents;
        await creator.save();
        
        console.log(`💰 Payout recorded: $${(amountCents / 100).toFixed(2)} to ${creator.name} (${creator.email})`);
        
        res.json({
            message: 'Payout recorded',
            payout,
            newPendingBalance: creator.pendingPayoutCents,
        });
    } catch (error) {
        console.error('Record payout error:', error);
        res.status(500).json({ error: 'Failed to record payout' });
    }
});

module.exports = router;
