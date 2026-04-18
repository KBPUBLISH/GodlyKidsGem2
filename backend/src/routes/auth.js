const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const AppUser = require('../models/AppUser');
const { authenticateUser } = require('../middleware/auth');

function escapeRegexEmail(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getProtectedAccountEmails() {
    const envEmails = process.env.ADMIN_EMAILS;
    if (envEmails) {
        return envEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    }
    return ['admin@godlykids.com', 'support@godlykids.com', 'hello@kbpublish.org'];
}

// Old backend configuration
const OLD_BACKEND_URL = process.env.OLD_BACKEND_URL || 'https://api.godlykids.kbpublish.org';
const MIGRATION_API_KEY = process.env.MIGRATION_API_KEY;

// Check if email exists in old backend
async function checkOldBackendEmail(email) {
    try {
        console.log('🔍 Checking old backend for email:', email);
        const response = await axios.post(
            `${OLD_BACKEND_URL}/payments/restore/subscription`,
            { email: email.toLowerCase().trim() },
            { 
                headers: { 
                    'X-Migration-API-Key': MIGRATION_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        // If we get a response (even with no subscription), the email exists
        console.log('📧 Old backend response:', response.data);
        return {
            exists: true,
            hasSubscription: response.data?.subscription?.isActive || false,
            subscriptionData: response.data?.subscription || null
        };
    } catch (error) {
        // 404 or other errors mean email not found
        console.log('📧 Email not found in old backend:', error.response?.status || error.message);
        return { exists: false, hasSubscription: false };
    }
}

// Register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            username,
            email,
            password,
        });

        await user.save();

        const payload = {
            user: {
                id: user.id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret', // Use environment variable in production
            { expiresIn: 360000 },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) {
            // User not found in new backend - check if they exist in old backend
            const oldBackendCheck = await checkOldBackendEmail(email);
            
            if (oldBackendCheck.exists) {
                // They have an account in the old system!
                return res.status(404).json({ 
                    msg: 'Account found in previous app',
                    code: 'LEGACY_ACCOUNT',
                    hasSubscription: oldBackendCheck.hasSubscription,
                    message: 'We found your account from our previous app! Please set a new password to continue.'
                });
            }
            
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: 360000 },
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    token, 
                    user: { 
                        id: user.id, 
                        username: user.username, 
                        email: user.email,
                        isPremium: user.isPremium || false
                    } 
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Migrate legacy user - create account with new password
router.post('/migrate-legacy', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    try {
        // Check if already exists in new backend
        let existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ msg: 'Account already exists. Please sign in.' });
        }

        // Verify they exist in old backend
        const oldBackendCheck = await checkOldBackendEmail(email);
        if (!oldBackendCheck.exists) {
            return res.status(400).json({ msg: 'No legacy account found for this email.' });
        }

        // Create new account
        const user = new User({
            username: email.split('@')[0],
            email: email.toLowerCase().trim(),
            password: password,
            isPremium: oldBackendCheck.hasSubscription, // Restore their subscription status!
        });

        await user.save();
        console.log('✅ Migrated legacy user:', email, 'isPremium:', oldBackendCheck.hasSubscription);

        const payload = {
            user: {
                id: user.id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: 360000 },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ 
                    token, 
                    user: { 
                        id: user.id, 
                        username: user.username, 
                        email: user.email,
                        isPremium: user.isPremium || false
                    },
                    migrated: true,
                    subscriptionRestored: oldBackendCheck.hasSubscription,
                    message: oldBackendCheck.hasSubscription 
                        ? 'Welcome back! Your account and subscription have been migrated! 🎉'
                        : 'Welcome back! Your account has been migrated.'
                });
            }
        );
    } catch (err) {
        console.error('Migration error:', err.message);
        res.status(500).json({ msg: 'Server error during migration' });
    }
});

/**
 * DELETE /api/auth/account
 * Authenticated user deletes their own login + linked app profile (App Store account-deletion requirement).
 */
router.delete('/account', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const emailLower = (user.email || '').toLowerCase().trim();
        if (!emailLower) {
            return res.status(400).json({ success: false, message: 'No email on account; cannot delete.' });
        }
        if (getProtectedAccountEmails().includes(emailLower)) {
            return res.status(403).json({ success: false, message: 'This account cannot be deleted.' });
        }
        await AppUser.deleteMany({
            email: new RegExp(`^${escapeRegexEmail(emailLower)}$`, 'i'),
        });
        await User.findByIdAndDelete(user._id);
        console.log(`🗑️ User self-service account deleted: ${emailLower}`);
        return res.json({ success: true, message: 'Account deleted' });
    } catch (err) {
        console.error('DELETE /auth/account error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete account' });
    }
});

module.exports = router;
