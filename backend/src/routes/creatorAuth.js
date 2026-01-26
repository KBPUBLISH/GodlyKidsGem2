const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Creator = require('../models/Creator');

// Middleware to authenticate creator
const authenticateCreator = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization provided' });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        if (decoded.role !== 'creator') {
            return res.status(403).json({ error: 'Creator access required' });
        }
        
        const creator = await Creator.findById(decoded.creatorId);
        
        if (!creator) {
            return res.status(401).json({ error: 'Creator not found' });
        }
        
        if (creator.status !== 'active') {
            return res.status(403).json({ error: 'Creator account is not active' });
        }

        req.creator = creator;
        next();
    } catch (error) {
        console.error('Creator auth error:', error.message);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// GET /api/creator/invite/:token - Get invite details
router.get('/invite/:token', async (req, res) => {
    try {
        const creator = await Creator.findOne({ 
            inviteToken: req.params.token,
            status: 'invited'
        });
        
        if (!creator) {
            return res.status(404).json({ error: 'Invalid or expired invite link' });
        }
        
        res.json({
            email: creator.email,
            name: creator.name,
            invitedAt: creator.invitedAt,
        });
    } catch (error) {
        console.error('Get invite error:', error);
        res.status(500).json({ error: 'Failed to get invite details' });
    }
});

// POST /api/creator/accept-invite - Accept invite and set password
router.post('/accept-invite', async (req, res) => {
    try {
        const { inviteToken, password, name, bio } = req.body;
        
        if (!inviteToken || !password) {
            return res.status(400).json({ error: 'Invite token and password are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const creator = await Creator.findOne({ 
            inviteToken,
            status: 'invited'
        });
        
        if (!creator) {
            return res.status(404).json({ error: 'Invalid or expired invite link' });
        }
        
        // Update creator
        creator.password = password;
        creator.status = 'active';
        creator.activatedAt = new Date();
        creator.inviteToken = undefined; // Remove invite token
        
        if (name) creator.name = name;
        if (bio) creator.bio = bio;
        
        await creator.save();
        
        // Generate JWT
        const token = jwt.sign(
            { 
                creatorId: creator._id,
                email: creator.email,
                role: 'creator'
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );
        
        res.json({
            message: 'Account activated successfully',
            token,
            creator: {
                id: creator._id,
                email: creator.email,
                name: creator.name,
                bio: creator.bio,
                profileImage: creator.profileImage,
            }
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to activate account' });
    }
});

// POST /api/creator/login - Creator login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const creator = await Creator.findOne({ email: email.toLowerCase() });
        
        if (!creator) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        if (creator.status === 'invited') {
            return res.status(403).json({ 
                error: 'Please accept your invite first',
                needsActivation: true
            });
        }
        
        if (creator.status === 'suspended') {
            return res.status(403).json({ error: 'Your account has been suspended' });
        }
        
        const isMatch = await creator.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { 
                creatorId: creator._id,
                email: creator.email,
                role: 'creator'
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );
        
        res.json({
            token,
            creator: {
                id: creator._id,
                email: creator.email,
                name: creator.name,
                bio: creator.bio,
                profileImage: creator.profileImage,
                status: creator.status,
                totalEarningsCents: creator.totalEarningsCents,
                pendingPayoutCents: creator.pendingPayoutCents,
            }
        });
    } catch (error) {
        console.error('Creator login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/creator/me - Get current creator profile
router.get('/me', authenticateCreator, async (req, res) => {
    try {
        const creator = req.creator;
        
        res.json({
            id: creator._id,
            email: creator.email,
            name: creator.name,
            bio: creator.bio,
            profileImage: creator.profileImage,
            website: creator.website,
            status: creator.status,
            activatedAt: creator.activatedAt,
            totalEarningsCents: creator.totalEarningsCents,
            pendingPayoutCents: creator.pendingPayoutCents,
            totalPaidOutCents: creator.totalPaidOutCents,
            totalContentCount: creator.totalContentCount,
            totalSalesCount: creator.totalSalesCount,
            payoutMethod: creator.payoutMethod,
            payoutEmail: creator.payoutEmail,
        });
    } catch (error) {
        console.error('Get creator profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// PUT /api/creator/me - Update creator profile
router.put('/me', authenticateCreator, async (req, res) => {
    try {
        const creator = req.creator;
        const { name, bio, website, payoutMethod, payoutEmail, payoutAddress } = req.body;
        
        if (name) creator.name = name;
        if (bio !== undefined) creator.bio = bio;
        if (website !== undefined) creator.website = website;
        if (payoutMethod) creator.payoutMethod = payoutMethod;
        if (payoutEmail) creator.payoutEmail = payoutEmail;
        if (payoutAddress) creator.payoutAddress = payoutAddress;
        
        await creator.save();
        
        res.json({
            message: 'Profile updated',
            creator: {
                id: creator._id,
                email: creator.email,
                name: creator.name,
                bio: creator.bio,
                profileImage: creator.profileImage,
                website: creator.website,
                payoutMethod: creator.payoutMethod,
                payoutEmail: creator.payoutEmail,
            }
        });
    } catch (error) {
        console.error('Update creator profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// PUT /api/creator/me/password - Change password
router.put('/me/password', authenticateCreator, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }
        
        const creator = req.creator;
        const isMatch = await creator.comparePassword(currentPassword);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        creator.password = newPassword;
        await creator.save();
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
module.exports.authenticateCreator = authenticateCreator;
