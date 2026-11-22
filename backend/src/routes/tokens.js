const express = require('express');
const router = express.Router();
const AppUser = require('../models/AppUser');
const TokenPurchase = require('../models/TokenPurchase');
const TokenTransaction = require('../models/TokenTransaction');
const HubPlaylist = require('../models/HubPlaylist');
const Creator = require('../models/Creator');
const { creatorEarningsCents: calculateCreatorEarnings } = require('../config/creatorEarnings');
const { grantTokenPack } = require('../utils/grantTokenPack');
const { identityFromRequest } = require('../utils/appIdentity');
const { optionalAuthenticateUser } = require('../middleware/auth');

function paymentsConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY && !String(process.env.STRIPE_SECRET_KEY).includes('xxx'));
}

const PAYMENTS_UNAVAILABLE = {
    error: 'payments_not_configured',
    message: 'Credit packs are listed, but card payments are not set up on this server. Credits were not added.',
};

// GET /api/tokens/bundles - Get available token bundles
router.get('/bundles', (req, res) => {
    try {
        const bundles = TokenPurchase.getAllBundles();
        res.json({
            bundles,
            paymentsConfigured: paymentsConfigured(),
            currency: 'usd',
        });
    } catch (error) {
        console.error('Get bundles error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
});

// POST /api/tokens/checkout - Start Stripe Checkout for a credit pack (web)
router.post('/checkout', optionalAuthenticateUser, async (req, res) => {
    try {
        if (!paymentsConfigured()) {
            return res.status(503).json(PAYMENTS_UNAVAILABLE);
        }

        const { bundleId, successUrl, cancelUrl } = req.body || {};
        const identity = identityFromRequest(req);

        if (!identity.userId) {
            return res.status(400).json({ error: 'userId or email is required' });
        }
        if (!TokenPurchase.isForSale(bundleId)) {
            return res.status(400).json({ error: 'Invalid bundle ID' });
        }

        const bundle = TokenPurchase.getBundleInfo(bundleId);
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const frontend = process.env.FRONTEND_URL || 'https://app.godlykids.com';

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    unit_amount: bundle.priceCents,
                    product_data: {
                        name: `${bundle.name} — ${bundle.tokens} credits`,
                        description: 'Godly Hub credits for creator stories',
                    },
                },
                quantity: 1,
            }],
            success_url: successUrl || `${frontend}/#/payment-success?session_id={CHECKOUT_SESSION_ID}&credits=1`,
            cancel_url: cancelUrl || `${frontend}/#/listen`,
            customer_email: identity.userEmail && identity.userEmail.includes('@')
                ? identity.userEmail
                : undefined,
            metadata: {
                kind: 'token_pack',
                bundleId,
                userId: identity.userId,
                userEmail: identity.userEmail || '',
            },
        });

        res.json({
            sessionId: session.id,
            url: session.url,
            bundle: {
                bundleId,
                tokens: bundle.tokens,
                priceCents: bundle.priceCents,
                name: bundle.name,
            },
        });
    } catch (error) {
        console.error('Token checkout error:', error);
        res.status(500).json({
            error: 'Failed to start checkout',
            message: error.message,
        });
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

// POST /api/tokens/purchase - Record token purchase after IAP or verified Stripe
router.post('/purchase', optionalAuthenticateUser, async (req, res) => {
    try {
        const identity = identityFromRequest(req);
        let { bundleId, transactionId, platform, receiptData } = req.body || {};
        const userId = identity.userId;
        const userEmail = identity.userEmail;

        if (!userId || !bundleId || !platform) {
            return res.status(400).json({ error: 'userId, bundleId, and platform are required' });
        }

        if (platform === 'web') {
            if (!paymentsConfigured()) {
                return res.status(503).json(PAYMENTS_UNAVAILABLE);
            }
            if (!transactionId) {
                return res.status(400).json({ error: 'Stripe session id is required for web purchases' });
            }
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.retrieve(transactionId);
            const paid = session.payment_status === 'paid' || session.status === 'complete';
            if (!paid || session.metadata?.kind !== 'token_pack') {
                return res.status(400).json({ error: 'Payment is not complete for this credit pack' });
            }
            bundleId = session.metadata.bundleId || bundleId;
        }

        if (!TokenPurchase.isForSale(bundleId) && platform === 'web') {
            return res.status(400).json({ error: 'Invalid bundle ID' });
        }

        const result = await grantTokenPack({
            userId,
            userEmail,
            bundleId,
            transactionId,
            platform,
            receiptData,
        });

        res.json({
            success: true,
            tokensAdded: result.tokensAdded,
            newBalance: result.newBalance,
            purchaseId: result.purchaseId,
            alreadyProcessed: result.alreadyProcessed,
        });
    } catch (error) {
        console.error('Token purchase error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to record purchase' });
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
        
        // Calculate creator earnings at this creator's rate
        const creator = await Creator.findById(playlist.creatorId);
        const creatorEarningsCents = calculateCreatorEarnings(price, creator);
        
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
