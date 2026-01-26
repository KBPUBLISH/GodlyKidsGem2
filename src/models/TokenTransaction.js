const mongoose = require('mongoose');

const tokenTransactionSchema = new mongoose.Schema({
    // User identification
    userId: {
        type: String,
        required: true,
        index: true,
    },
    userEmail: {
        type: String,
        index: true,
    },
    
    // Transaction type
    type: {
        type: String,
        enum: ['purchase', 'spend', 'refund', 'bonus', 'admin_adjustment'],
        required: true,
        index: true,
    },
    
    // Amount (positive for gains, negative for spends)
    amount: {
        type: Number,
        required: true,
    },
    
    // Balance after this transaction
    balanceAfter: {
        type: Number,
        required: true,
    },
    
    // Related references
    relatedPurchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TokenPurchase',
    },
    relatedPlaylistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HubPlaylist',
    },
    relatedCreatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
    },
    
    // Description for transaction history
    description: {
        type: String,
        required: true,
    },
    
    // For spend transactions, track creator earnings
    creatorEarningsCents: {
        type: Number, // Amount credited to creator (in cents)
        default: 0,
    },
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
    
}, {
    timestamps: true,
});

// Indexes for queries
tokenTransactionSchema.index({ userId: 1, createdAt: -1 });
tokenTransactionSchema.index({ type: 1, createdAt: -1 });
tokenTransactionSchema.index({ relatedCreatorId: 1, createdAt: -1 });
tokenTransactionSchema.index({ relatedPlaylistId: 1 });

module.exports = mongoose.model('TokenTransaction', tokenTransactionSchema);
