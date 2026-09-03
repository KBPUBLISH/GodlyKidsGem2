const mongoose = require('mongoose');

// Three credit packs parents can buy. $1 per 10 credits on the starter pack,
// with a modest bundle discount on the larger two.
const TOKEN_SALE_BUNDLES = {
    'godlykids_tokens_10': { tokens: 10, priceCents: 1000, name: 'Starter Pack' },
    'godlykids_tokens_25': { tokens: 25, priceCents: 2000, name: 'Family Pack' },
    'godlykids_tokens_50': { tokens: 50, priceCents: 4000, name: 'Voyage Pack' },
};

// Historic Super Saver receipts must still validate on this schema.
const TOKEN_BUNDLES = {
    ...TOKEN_SALE_BUNDLES,
    'godlykids_tokens_100': { tokens: 100, priceCents: 6999, name: 'Super Saver', legacy: true },
};

const tokenPurchaseSchema = new mongoose.Schema({
    // User identification (can be deviceId or email)
    userId: {
        type: String,
        required: true,
        index: true,
    },
    userEmail: {
        type: String,
        index: true,
    },
    
    // Purchase details
    bundleId: {
        type: String,
        required: true,
        enum: Object.keys(TOKEN_BUNDLES),
    },
    tokenAmount: {
        type: Number,
        required: true,
    },
    priceCents: {
        type: Number,
        required: true,
    },
    
    // Platform & transaction tracking
    platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
        required: true,
    },
    transactionId: {
        type: String, // Apple/Google receipt ID or Stripe payment intent
        index: true,
    },
    receiptData: {
        type: String, // Full receipt for verification (if needed)
    },
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed',
        index: true,
    },
    
    // Refund tracking
    refundedAt: {
        type: Date,
    },
    refundReason: {
        type: String,
    },
    
}, {
    timestamps: true,
});

// Indexes
tokenPurchaseSchema.index({ userId: 1, createdAt: -1 });
tokenPurchaseSchema.index({ status: 1, createdAt: -1 });
tokenPurchaseSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

tokenPurchaseSchema.statics.getBundleInfo = function(bundleId) {
    return TOKEN_BUNDLES[bundleId] || null;
};

tokenPurchaseSchema.statics.getAllBundles = function() {
    return Object.entries(TOKEN_SALE_BUNDLES).map(([id, info]) => ({
        bundleId: id,
        ...info,
        priceFormatted: `$${(info.priceCents / 100).toFixed(2)}`,
        effectiveRate: `$${(info.priceCents / info.tokens / 100).toFixed(2)}/credit`,
    }));
};

tokenPurchaseSchema.statics.isForSale = function(bundleId) {
    return Boolean(TOKEN_SALE_BUNDLES[bundleId]);
};

module.exports = mongoose.model('TokenPurchase', tokenPurchaseSchema);
module.exports.TOKEN_BUNDLES = TOKEN_BUNDLES;
module.exports.TOKEN_SALE_BUNDLES = TOKEN_SALE_BUNDLES;
