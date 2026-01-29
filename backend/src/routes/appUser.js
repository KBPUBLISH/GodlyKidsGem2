const express = require('express');
const router = express.Router();
const AppUser = require('../models/AppUser');

/**
 * POST /api/app-user/preferences
 * Save user's onboarding preferences (discipleship goals and feature interests)
 */
router.post('/preferences', async (req, res) => {
    try {
        const { deviceId, email, discipleshipGoals, featureInterests, parentName, kids } = req.body;
        
        if (!deviceId && !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either deviceId or email is required' 
            });
        }
        
        // Find or create user
        let query = {};
        if (email) {
            query = { email: email.toLowerCase().trim() };
        } else {
            query = { deviceId };
        }
        
        let user = await AppUser.findOne(query);
        
        if (!user) {
            // Create new user
            user = new AppUser({
                deviceId,
                email: email ? email.toLowerCase().trim() : undefined,
            });
        }
        
        // Update preferences
        if (discipleshipGoals && Array.isArray(discipleshipGoals)) {
            user.discipleshipGoals = discipleshipGoals;
        }
        
        if (featureInterests && Array.isArray(featureInterests)) {
            user.featureInterests = featureInterests;
        }
        
        if (parentName) {
            user.parentName = parentName;
        }
        
        if (kids && Array.isArray(kids)) {
            user.kidProfiles = kids.map(k => ({
                name: k.name,
                age: k.age,
                avatar: k.avatar,
            }));
        }
        
        // Update onboarding status
        user.onboardingStatus = 'in_progress';
        user.lastActiveAt = new Date();
        
        await user.save();
        
        console.log('✅ Saved user preferences:', {
            userId: user._id,
            discipleshipGoals: user.discipleshipGoals,
            featureInterests: user.featureInterests,
        });
        
        res.json({ 
            success: true,
            userId: user._id,
            message: 'Preferences saved successfully'
        });
        
    } catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save preferences' 
        });
    }
});

/**
 * GET /api/app-user/preferences/:identifier
 * Get user's preferences by deviceId or email
 */
router.get('/preferences/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Try to find by email first, then deviceId
        let user = await AppUser.findOne({ 
            $or: [
                { email: identifier.toLowerCase() },
                { deviceId: identifier }
            ]
        });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        res.json({
            success: true,
            preferences: {
                discipleshipGoals: user.discipleshipGoals || [],
                featureInterests: user.featureInterests || [],
                parentName: user.parentName,
                kidProfiles: user.kidProfiles || [],
            }
        });
        
    } catch (error) {
        console.error('Error getting preferences:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get preferences' 
        });
    }
});

/**
 * POST /api/app-user/link-email
 * Link a device ID to an email address after account creation
 */
router.post('/link-email', async (req, res) => {
    try {
        const { deviceId, email } = req.body;
        
        if (!deviceId || !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both deviceId and email are required' 
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // First, check if there's an existing user with this email
        const existingEmailUser = await AppUser.findOne({ email: normalizedEmail });
        
        // Find the device-based user
        const deviceUser = await AppUser.findOne({ deviceId });
        
        if (existingEmailUser && deviceUser && existingEmailUser._id.toString() !== deviceUser._id.toString()) {
            // Merge: copy data from device user to email user
            if (deviceUser.discipleshipGoals?.length) {
                existingEmailUser.discipleshipGoals = deviceUser.discipleshipGoals;
            }
            if (deviceUser.featureInterests?.length) {
                existingEmailUser.featureInterests = deviceUser.featureInterests;
            }
            if (deviceUser.parentName) {
                existingEmailUser.parentName = deviceUser.parentName;
            }
            if (deviceUser.kidProfiles?.length) {
                existingEmailUser.kidProfiles = deviceUser.kidProfiles;
            }
            existingEmailUser.deviceId = deviceId; // Link device to email account
            existingEmailUser.lastActiveAt = new Date();
            await existingEmailUser.save();
            
            // Delete the orphan device user
            await AppUser.deleteOne({ _id: deviceUser._id });
            
            console.log('✅ Merged device user into existing email user:', normalizedEmail);
            
            return res.json({ 
                success: true,
                userId: existingEmailUser._id,
                message: 'Account merged successfully'
            });
        }
        
        if (deviceUser) {
            // Update device user with email
            deviceUser.email = normalizedEmail;
            deviceUser.lastActiveAt = new Date();
            await deviceUser.save();
            
            console.log('✅ Linked email to device user:', normalizedEmail);
            
            return res.json({ 
                success: true,
                userId: deviceUser._id,
                message: 'Email linked successfully'
            });
        }
        
        // No device user found, create new one with email
        const newUser = new AppUser({
            deviceId,
            email: normalizedEmail,
            lastActiveAt: new Date(),
        });
        await newUser.save();
        
        console.log('✅ Created new user with email:', normalizedEmail);
        
        res.json({ 
            success: true,
            userId: newUser._id,
            message: 'User created with email'
        });
        
    } catch (error) {
        console.error('Error linking email:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to link email' 
        });
    }
});

/**
 * POST /api/app-user/complete-onboarding
 * Mark onboarding as complete and save final preferences
 */
router.post('/complete-onboarding', async (req, res) => {
    try {
        const { deviceId, email, selectedVoiceId } = req.body;
        
        if (!deviceId && !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either deviceId or email is required' 
            });
        }
        
        let query = {};
        if (email) {
            query = { email: email.toLowerCase().trim() };
        } else {
            query = { deviceId };
        }
        
        const user = await AppUser.findOneAndUpdate(
            query,
            {
                $set: {
                    onboardingStatus: 'completed',
                    onboardingCompletedAt: new Date(),
                    lastActiveAt: new Date(),
                    defaultVoiceId: selectedVoiceId,
                }
            },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        console.log('✅ Onboarding completed for user:', user._id);
        
        res.json({ 
            success: true,
            userId: user._id,
            message: 'Onboarding completed'
        });
        
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to complete onboarding' 
        });
    }
});

/**
 * POST /api/app-user/start-reverse-trial
 * Start a 7-day reverse trial when user closes paywall
 */
router.post('/start-reverse-trial', async (req, res) => {
    try {
        const { deviceId, email } = req.body;
        
        if (!deviceId && !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either deviceId or email is required' 
            });
        }
        
        // Find user
        let query = {};
        if (email) {
            query = { $or: [{ email: email.toLowerCase().trim() }, { deviceId }] };
        } else {
            query = { deviceId };
        }
        
        let user = await AppUser.findOne(query);
        
        if (!user) {
            // Create user if doesn't exist
            user = new AppUser({
                deviceId,
                email: email ? email.toLowerCase().trim() : undefined,
            });
        }
        
        // Check eligibility: not already on reverse trial, not premium, never had reverse trial
        if (user.reverseTrialStartDate) {
            return res.json({ 
                success: false, 
                error: 'User has already had a reverse trial',
                alreadyTrialed: true
            });
        }
        
        if (user.subscriptionStatus === 'active') {
            return res.json({ 
                success: false, 
                error: 'User is already premium',
                alreadyPremium: true
            });
        }
        
        // Start the reverse trial
        user.reverseTrialStartDate = new Date();
        user.reverseTrialActive = true;
        user.reverseTrialConverted = false;
        user.reverseTrialNudgeSent = false;
        user.subscriptionStatus = 'reverse_trial';
        user.lastActiveAt = new Date();
        
        await user.save();
        
        console.log('🎁 Reverse trial started for user:', user._id);
        
        res.json({ 
            success: true,
            userId: user._id,
            trialStartDate: user.reverseTrialStartDate,
            trialEndDate: new Date(user.reverseTrialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            message: 'Reverse trial started! Enjoy 7 days of premium.'
        });
        
    } catch (error) {
        console.error('Error starting reverse trial:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start reverse trial' 
        });
    }
});

/**
 * GET /api/app-user/reverse-trial-status/:identifier
 * Check reverse trial status
 */
router.get('/reverse-trial-status/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Try to find by email first, then deviceId
        const user = await AppUser.findOne({ 
            $or: [
                { email: identifier.toLowerCase() },
                { deviceId: identifier }
            ]
        });
        
        if (!user) {
            return res.json({ 
                success: true,
                hasReverseTrial: false,
                isActive: false,
                eligible: true // No user = eligible for trial
            });
        }
        
        // Check if user has/had a reverse trial
        if (!user.reverseTrialStartDate) {
            return res.json({ 
                success: true,
                hasReverseTrial: false,
                isActive: false,
                eligible: user.subscriptionStatus !== 'active'
            });
        }
        
        // Calculate trial status
        const now = new Date();
        const trialEndDate = new Date(user.reverseTrialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (24 * 60 * 60 * 1000)));
        const isActive = user.reverseTrialActive && now < trialEndDate;
        
        // If trial has expired but still marked active, update it
        if (user.reverseTrialActive && now >= trialEndDate) {
            user.reverseTrialActive = false;
            if (user.subscriptionStatus === 'reverse_trial') {
                user.subscriptionStatus = 'expired';
            }
            await user.save();
        }
        
        res.json({ 
            success: true,
            hasReverseTrial: true,
            isActive,
            trialStartDate: user.reverseTrialStartDate,
            trialEndDate,
            daysRemaining,
            converted: user.reverseTrialConverted,
            eligible: false // Already had trial
        });
        
    } catch (error) {
        console.error('Error checking reverse trial status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check reverse trial status' 
        });
    }
});

/**
 * POST /api/app-user/reverse-trial-converted
 * Mark reverse trial as converted (user subscribed)
 */
router.post('/reverse-trial-converted', async (req, res) => {
    try {
        const { deviceId, email } = req.body;
        
        if (!deviceId && !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either deviceId or email is required' 
            });
        }
        
        let query = {};
        if (email) {
            query = { $or: [{ email: email.toLowerCase().trim() }, { deviceId }] };
        } else {
            query = { deviceId };
        }
        
        const user = await AppUser.findOneAndUpdate(
            query,
            {
                $set: {
                    reverseTrialConverted: true,
                    reverseTrialActive: false,
                    lastActiveAt: new Date(),
                }
            },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        console.log('🎉 Reverse trial converted for user:', user._id);
        
        res.json({ 
            success: true,
            userId: user._id,
            message: 'Reverse trial marked as converted'
        });
        
    } catch (error) {
        console.error('Error marking reverse trial converted:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark reverse trial converted' 
        });
    }
});

/**
 * GET /api/app-user/stats/:identifier
 * Get user stats for reverse trial expiry modal
 */
router.get('/stats/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        const user = await AppUser.findOne({ 
            $or: [
                { email: identifier.toLowerCase() },
                { deviceId: identifier }
            ]
        });
        
        if (!user) {
            return res.json({ 
                success: true,
                stats: {
                    booksRead: 0,
                    quizzesCompleted: 0,
                    coinsEarned: 0,
                    lessonsCompleted: 0,
                }
            });
        }
        
        res.json({ 
            success: true,
            stats: {
                booksRead: user.stats?.booksRead || 0,
                quizzesCompleted: user.stats?.quizzesCompleted || 0,
                coinsEarned: user.coins || 0,
                lessonsCompleted: user.stats?.lessonsCompleted || 0,
                totalSessions: user.stats?.totalSessions || 0,
            },
            kidProfiles: user.kidProfiles || [],
        });
        
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get user stats' 
        });
    }
});

module.exports = router;
