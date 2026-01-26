const mongoose = require('mongoose');

const creatorPayoutSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
        required: true,
        index: true,
    },
    
    // Amount paid (in cents)
    amountCents: {
        type: Number,
        required: true,
    },
    
    // Payout method used
    method: {
        type: String,
        enum: ['paypal', 'venmo', 'check', 'other'],
        required: true,
    },
    
    // Transaction reference
    transactionReference: {
        type: String, // PayPal transaction ID, check number, etc.
    },
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'sent', 'completed', 'failed'],
        default: 'pending',
        index: true,
    },
    
    // Notes
    notes: {
        type: String,
    },
    
    // Admin who processed the payout
    processedBy: {
        type: String,
    },
    processedAt: {
        type: Date,
    },
    
    // Period this payout covers
    periodStart: {
        type: Date,
    },
    periodEnd: {
        type: Date,
    },
    
}, {
    timestamps: true,
});

// Indexes
creatorPayoutSchema.index({ creatorId: 1, createdAt: -1 });
creatorPayoutSchema.index({ status: 1 });

module.exports = mongoose.model('CreatorPayout', creatorPayoutSchema);
