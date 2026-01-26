const express = require('express');
const router = express.Router();
const AppUser = require('../models/AppUser');
const TokenPurchase = require('../models/TokenPurchase');
const TokenTransaction = require('../models/TokenTransaction');
const HubPlaylist = require('../models/HubPlaylist');
const Creator = require('../models/Creator');

// Helper to get/create AppUser
const getOrCreateAppUser = async (userId, userEmail) => {
    let appUser = await AppUser.findOne({
        $or: [
            { deviceId: userId },
            { email: userEmail?.toLowerCase() }
        ]
    });
    
    if (!appUser) {
        appUser = new AppUser({
            deviceId: userId,
            email: userEmail?.toLowerCase(),
            tokenBalance: 0,
        });
        await appUser.save();
    }
    
    return appUser;
};

// GET /api/tokens/bundles - Get available token bundles
router.get('/bundles', (req, res) => {
    try {
        const bundles = TokenPurchase.getAllBundles();
        res.json({ bundles });
    } catch (error) {
        console.error('Get bundles error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
});

// GET /api/tokens/balance - Get user's token balance
router.get('/balance', async (req, res) => {
    try {
        const { userId, email } = req.query;
        
        if (!userId && !email) {
            return res.status(400).json({ error: 'userId or email is required' });
        }
        
        const appUser = await AppUser.findOne({
            $or: [
                { deviceId: userId },
                { email: email?.toLowerCase() }
            ]
        });
        
        res.json({
            balance: appUser?.tokenBalance || 0,
            hubPurchasesCount: appUser?.hubPurchases?.length || 0,
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// POST /api/tokens/purchase - Record token purchase (after IAP verification)
router.post('/purchase', async (req, res) => {
    try {
        const { userId, userEmail, bundleId, transactionId, platform, receiptData } = req.body;
        
        if (!userId || !bundleId || !platform) {
            return res.status(400).json({ error: 'userId, bundleId, and platform are required' });
        }
        
        // Check for duplicate transaction
        if (transactionId) {
            const existing = await TokenPurchase.findOne({ transactionId });
            if (existing) {
                return res.status(409).json({ error: 'Transaction already processed' });
            }
        }
        
        // Get bundle info
        const bundleInfo = TokenPurchase.getBundleInfo(bundleId);
        if (!bundleInfo) {
            return res.status(400).json({ error: 'Invalid bundle ID' });
        }
        
        // Get or create app user
        const appUser = await getOrCreateAppUser(userId, userEmail);
        
        // Record purchase
        const purchase = new TokenPurchase({
            userId,
            userEmail: userEmail?.toLowerCase(),
            bundleId,
            tokenAmount: bundleInfo.tokens,
            priceCents: bundleInfo.priceCents,
            platform,
            transactionId,
            receiptData,
            status: 'completed',
        });
        await purchase.save();
        
        // Update user balance
        const previousBalance = appUser.tokenBalance || 0;
        appUser.tokenBalance = previousBalance + bundleInfo.tokens;
        await appUser.save();
        
        // Record transaction
        const transaction = new TokenTransaction({
            userId,
            userEmail: userEmail?.toLowerCase(),
            type: 'purchase',
            amount: bundleInfo.tokens,
            balanceAfter: appUser.tokenBalance,
            relatedPurchaseId: purchase._id,
            description: `Purchased ${bundleInfo.name} (${bundleInfo.tokens} tokens)`,
        });
        await transaction.save();
        
        console.log(`✅ Token purchase: ${userId} bought ${bundleInfo.tokens} tokens (${bundleId})`);
        
        res.json({
            success: true,
            tokensAdded: bundleInfo.tokens,
            newBalance: appUser.tokenBalance,
            purchaseId: purchase._id,
        });
    } catch (error) {
        console.error('Token purchase error:', error);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
});

// POST /api/tokens/spend - Spend tokens on Hub content
router.post('/spend', async (req, res) => {
    try {
        const { userId, userEmail, playlistId } = req.body;
        
        if (!userId || !playlistId) {
            return res.status(400).json({ error: 'userId and playlistId are required' });
        }
        
        // Get playlist
        const playlist = await HubPlaylist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        if (playlist.status !== 'published') {
            return res.status(400).json({ error: 'This content is not available for purchase' });
        }
        
        // Get app user
        const appUser = await AppUser.findOne({
            $or: [
                { deviceId: userId },
                { email: userEmail?.toLowerCase() }
            ]
        });
        
        if (!appUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if already purchased
        const alreadyPurchased = appUser.hubPurchases?.some(
            p => p.playlistId?.toString() === playlistId
        );
        
        if (alreadyPurchased) {
            return res.status(400).json({ error: 'You already own this content' });
        }
        
        // Check balance
        const price = playlist.priceTokens;
        if ((appUser.tokenBalance || 0) < price) {
            return res.status(400).json({ 
                error: 'Insufficient tokens',
                required: price,
                current: appUser.tokenBalance || 0,
            });
        }
        
        // Calculate creator earnings
        // Assuming average token cost of $0.80 (from 50-token bundle)
        // After Apple 15% = $0.68 per token
        // Creator gets 80% = $0.544 per token ≈ 54 cents
        const creatorEarningsCents = Math.round(price * 54);
        
        // Deduct tokens
        appUser.tokenBalance -= price;
        appUser.hubPurchases = appUser.hubPurchases || [];
        appUser.hubPurchases.push({
            playlistId: playlist._id,
            purchasedAt: new Date(),
            tokensPaid: price,
        });
        await appUser.save();
        
        // Update playlist stats
        playlist.purchaseCount = (playlist.purchaseCount || 0) + 1;
        playlist.totalTokensEarned = (playlist.totalTokensEarned || 0) + price;
        await playlist.save();
        
        // Update creator earnings
        const creator = await Creator.findById(playlist.creatorId);
        if (creator) {
            creator.totalEarningsCents = (creator.totalEarningsCents || 0) + creatorEarningsCents;
            creator.pendingPayoutCents = (creator.pendingPayoutCents || 0) + creatorEarningsCents;
            creator.totalSalesCount = (creator.totalSalesCount || 0) + 1;
            await creator.save();
        }
        
        // Record transaction
        const transaction = new TokenTransaction({
            userId,
            userEmail: userEmail?.toLowerCase(),
            type: 'spend',
            amount: -price,
            balanceAfter: appUser.tokenBalance,
            relatedPlaylistId: playlist._id,
            relatedCreatorId: playlist.creatorId,
            description: `Purchased "${playlist.title}"`,
            creatorEarningsCents,
        });
        await transaction.save();
        
        console.log(`✅ Content purchase: ${userId} bought "${playlist.title}" for ${price} tokens`);
        
        res.json({
            success: true,
            tokensSpent: price,
            newBalance: appUser.tokenBalance,
            playlistId: playlist._id,
        });
    } catch (error) {
        console.error('Token spend error:', error);
        res.status(500).json({ error: 'Failed to complete purchase' });
    }
});

// GET /api/tokens/history - Get transaction history
router.get('/history', async (req, res) => {
    try {
        const { userId, email, limit = 50, offset = 0 } = req.query;
        
        if (!userId && !email) {
            return res.status(400).json({ error: 'userId or email is required' });
        }
        
        const query = {};
        if (userId) query.userId = userId;
        if (email) query.userEmail = email.toLowerCase();
        
        const transactions = await TokenTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();
        
        const total = await TokenTransaction.countDocuments(query);
        
        res.json({
            transactions,
            total,
            hasMore: (parseInt(offset) + transactions.length) < total,
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get transaction history' });
    }
});

// GET /api/tokens/purchases - Get user's Hub purchases
router.get('/purchases', async (req, res) => {
    try {
        const { userId, email } = req.query;
        
        if (!userId && !email) {
            return res.status(400).json({ error: 'userId or email is required' });
        }
        
        const appUser = await AppUser.findOne({
            $or: [
                { deviceId: userId },
                { email: email?.toLowerCase() }
            ]
        });
        
        if (!appUser || !appUser.hubPurchases?.length) {
            return res.json({ purchases: [] });
        }
        
        // Get full playlist details
        const playlistIds = appUser.hubPurchases.map(p => p.playlistId);
        const playlists = await HubPlaylist.find({ _id: { $in: playlistIds } })
            .populate('creatorId', 'name profileImage')
            .lean();
        
        // Merge purchase info with playlist data
        const purchases = appUser.hubPurchases.map(purchase => {
            const playlist = playlists.find(p => p._id.toString() === purchase.playlistId?.toString());
            return {
                ...purchase,
                playlist: playlist || null,
            };
        });
        
        res.json({ purchases });
    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({ error: 'Failed to get purchases' });
    }
});

// GET /api/tokens/owns/:playlistId - Check if user owns specific content
router.get('/owns/:playlistId', async (req, res) => {
    try {
        const { userId, email } = req.query;
        const { playlistId } = req.params;
        
        if (!userId && !email) {
            return res.status(400).json({ error: 'userId or email is required' });
        }
        
        const appUser = await AppUser.findOne({
            $or: [
                { deviceId: userId },
                { email: email?.toLowerCase() }
            ]
        });
        
        const owns = appUser?.hubPurchases?.some(
            p => p.playlistId?.toString() === playlistId
        ) || false;
        
        res.json({ owns });
    } catch (error) {
        console.error('Check ownership error:', error);
        res.status(500).json({ error: 'Failed to check ownership' });
    }
});

module.exports = router;
