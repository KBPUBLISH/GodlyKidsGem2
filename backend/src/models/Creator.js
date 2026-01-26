const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const creatorSchema = new mongoose.Schema({
    // Authentication
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        // Not required until they accept invite
    },
    
    // Profile
    name: {
        type: String,
        required: true,
    },
    bio: {
        type: String,
        default: '',
    },
    profileImage: {
        type: String, // URL to GCS
    },
    website: {
        type: String,
    },
    
    // Status
    status: {
        type: String,
        enum: ['invited', 'active', 'suspended'],
        default: 'invited',
        index: true,
    },
    
    // Invite tracking
    inviteToken: {
        type: String,
        unique: true,
        sparse: true,
    },
    invitedAt: {
        type: Date,
        default: Date.now,
    },
    invitedBy: {
        type: String, // Admin email who sent invite
    },
    activatedAt: {
        type: Date,
    },
    
    // Earnings tracking (stored in cents to avoid floating point issues)
    totalEarningsCents: {
        type: Number,
        default: 0,
    },
    pendingPayoutCents: {
        type: Number,
        default: 0,
    },
    totalPaidOutCents: {
        type: Number,
        default: 0,
    },
    
    // Payout info (for future automated payouts)
    payoutMethod: {
        type: String,
        enum: ['paypal', 'venmo', 'check', null],
        default: null,
    },
    payoutEmail: {
        type: String, // PayPal or Venmo email
    },
    payoutAddress: {
        type: String, // For check payments
    },
    
    // Stats
    totalContentCount: {
        type: Number,
        default: 0,
    },
    totalSalesCount: {
        type: Number,
        default: 0,
    },
    
}, {
    timestamps: true,
});

// Hash password before saving
creatorSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
creatorSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate invite token
creatorSchema.statics.generateInviteToken = function() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

// Indexes
creatorSchema.index({ inviteToken: 1 });
creatorSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Creator', creatorSchema);
