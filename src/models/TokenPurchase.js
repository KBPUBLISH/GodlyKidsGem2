const mongoose = require('mongoose');

// Token bundle definitions
const TOKEN_BUNDLES = {
    'godlykids_tokens_10': { tokens: 10, priceCents: 999, name: 'Starter Pack' },
    'godlykids_tokens_25': { tokens: 25, priceCents: 1999, name: 'Popular Pack' },
    'godlykids_tokens_50': { tokens: 50, priceCents: 3999, name: 'Best Value' },
    'godlykids_tokens_100': { tokens: 100, priceCents: 6999, name: 'Super Saver' },
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

// Static method to get bundle info
tokenPurchaseSchema.statics.getBundleInfo = function(bundleId) {
    return TOKEN_BUNDLES[bundleId] || null;
};

// Static method to get all bundles
tokenPurchaseSchema.statics.getAllBundles = function() {
    return Object.entries(TOKEN_BUNDLES).map(([id, info]) => ({
        bundleId: id,
        ...info,
        priceFormatted: `$${(info.priceCents / 100).toFixed(2)}`,
        effectiveRate: `$${(info.priceCents / info.tokens / 100).toFixed(2)}/token`,
    }));
};

module.exports = mongoose.model('TokenPurchase', tokenPurchaseSchema);
module.exports.TOKEN_BUNDLES = TOKEN_BUNDLES;
