const AppUser = require('../models/AppUser');
const TokenPurchase = require('../models/TokenPurchase');
const TokenTransaction = require('../models/TokenTransaction');

async function getOrCreateAppUser(userId, userEmail) {
    const email = userEmail?.toLowerCase();
    let appUser = await AppUser.findOne({
        $or: [
            { deviceId: userId },
            ...(email ? [{ email }] : []),
        ],
    });

    if (!appUser) {
        appUser = new AppUser({
            deviceId: userId,
            email,
            tokenBalance: 0,
        });
        await appUser.save();
    }

    return appUser;
}

/**
 * Credit a verified pack purchase. Safe to call from Stripe webhook and from
 * the success-page verify path: the Stripe session id is the unique
 * transactionId, so a second call returns the existing grant.
 */
async function grantTokenPack({
    userId,
    userEmail,
    bundleId,
    transactionId,
    platform,
    receiptData,
}) {
    if (!userId || !bundleId || !platform) {
        const error = new Error('userId, bundleId, and platform are required');
        error.status = 400;
        throw error;
    }

    const bundleInfo = TokenPurchase.getBundleInfo(bundleId);
    if (!bundleInfo || bundleInfo.legacy) {
        const error = new Error('Invalid bundle ID');
        error.status = 400;
        throw error;
    }

    if (transactionId) {
        const existing = await TokenPurchase.findOne({ transactionId });
        if (existing) {
            const appUser = await getOrCreateAppUser(userId, userEmail);
            return {
                alreadyProcessed: true,
                tokensAdded: existing.tokenAmount,
                newBalance: appUser.tokenBalance || 0,
                purchaseId: existing._id,
            };
        }
    }

    const appUser = await getOrCreateAppUser(userId, userEmail);

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

    const previousBalance = appUser.tokenBalance || 0;
    appUser.tokenBalance = previousBalance + bundleInfo.tokens;
    await appUser.save();

    await new TokenTransaction({
        userId,
        userEmail: userEmail?.toLowerCase(),
        type: 'purchase',
        amount: bundleInfo.tokens,
        balanceAfter: appUser.tokenBalance,
        relatedPurchaseId: purchase._id,
        description: `Purchased ${bundleInfo.name} (${bundleInfo.tokens} credits)`,
    }).save();

    console.log(`✅ Token purchase: ${userId} bought ${bundleInfo.tokens} credits (${bundleId})`);

    return {
        alreadyProcessed: false,
        tokensAdded: bundleInfo.tokens,
        newBalance: appUser.tokenBalance,
        purchaseId: purchase._id,
    };
}

module.exports = { grantTokenPack, getOrCreateAppUser };
