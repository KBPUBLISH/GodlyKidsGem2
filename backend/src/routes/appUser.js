const express = require('express');
const router = express.Router();
const AppUser = require('../models/AppUser');
const ReverseTrialDevice = require('../models/ReverseTrialDevice');

/**
 * POST /api/app-user/register-device
 * Register a device on first app launch - creates AppUser record immediately
 * This ensures we track all app opens, not just engaged users
 */
router.post('/register-device', async (req, res) => {
    try {
        const { deviceId, platform, appVersion } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'deviceId is required' 
            });
        }
        
        // Find existing user or create new one
        let user = await AppUser.findOne({ deviceId });
        let isNewUser = false;
        
        if (!user) {
            // Create new user record - this tracks the "install"
            user = new AppUser({
                deviceId,
                platform: platform || 'unknown',
                subscriptionStatus: 'free',
                stats: {
                    totalSessions: 1,
                    totalTimeSpent: 0,
                },
                lastActiveAt: new Date(),
            });
            isNewUser = true;
            console.log(`📱 New device registered: ${deviceId} (platform: ${platform || 'unknown'})`);
        } else {
            // Update existing user's last active and increment sessions
            user.lastActiveAt = new Date();
            user.stats = user.stats || {};
            user.stats.totalSessions = (user.stats.totalSessions || 0) + 1;
            if (platform && !user.platform) {
                user.platform = platform;
            }
        }
        
        await user.save();
        
        res.json({ 
            success: true,
            isNewUser,
            userId: user._id,
            subscriptionStatus: user.subscriptionStatus,
            reverseTrialActive: user.reverseTrialActive || false,
        });
        
    } catch (error) {
        console.error('Error registering device:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to register device' 
        });
    }
});

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
            // Preserve premium from device user if they purchased before creating account
            if (deviceUser.subscriptionStatus === 'active') {
                existingEmailUser.subscriptionStatus = 'active';
                existingEmailUser.subscriptionPlan = deviceUser.subscriptionPlan || existingEmailUser.subscriptionPlan;
                existingEmailUser.subscriptionStartDate = deviceUser.subscriptionStartDate || existingEmailUser.subscriptionStartDate;
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
 * 
 * IMPORTANT: Checks both user history AND device history to prevent:
 * - Same user starting multiple trials
 * - Same device being used with different accounts to get multiple trials
 */
router.post('/start-reverse-trial', async (req, res) => {
    try {
        const { deviceId, email, platform, trialDurationHours: rawDuration } = req.body;
        const trialDurationHours = Math.min(Math.max(parseInt(rawDuration, 10) || 168, 1), 168);
        
        if (!deviceId && !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either deviceId or email is required' 
            });
        }
        
        // CRITICAL: Check if this DEVICE has ever used a reverse trial
        // This prevents users from signing out and creating new accounts to get more trials
        if (deviceId) {
            const deviceUsedTrial = await ReverseTrialDevice.findOne({ deviceId });
            if (deviceUsedTrial) {
                console.log(`🚫 Device ${deviceId} already used reverse trial on ${deviceUsedTrial.trialStartedAt}`);
                return res.json({ 
                    success: false, 
                    error: 'This device has already used a reverse trial',
                    alreadyTrialed: true,
                    deviceBlocked: true,
                    previousTrialDate: deviceUsedTrial.trialStartedAt
                });
            }
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
                platform: platform || 'unknown',
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
        
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + trialDurationHours * 60 * 60 * 1000);
        const daysRemaining = Math.max(0, Math.ceil(trialDurationHours / 24));
        
        // Start the reverse trial
        user.reverseTrialStartDate = trialStartDate;
        user.reverseTrialActive = true;
        user.reverseTrialConverted = false;
        user.reverseTrialNudgeSent = false;
        user.reverseTrialNotificationsSent = {
            threeDays: false,
            twoDays: false,
            oneDay: false,
        };
        user.subscriptionStatus = 'reverse_trial';
        user.lastActiveAt = new Date();
        
        await user.save();
        
        // CRITICAL: Record this device as having used a reverse trial
        // This prevents the device from ever getting another trial
        if (deviceId) {
            await ReverseTrialDevice.create({
                deviceId,
                userId: user._id,
                email: user.email || null,
                trialDurationHours,
                trialStartedAt: trialStartDate,
                trialEndedAt: trialEndDate,
                platform: platform || user.platform || 'unknown',
                converted: false,
            });
            console.log(`📱 Recorded device ${deviceId} as having used reverse trial (${trialDurationHours}h)`);
        }
        
        console.log('🎁 Reverse trial started for user:', user._id, '- Device:', deviceId, `- Duration: ${trialDurationHours}h`);
        
        res.json({ 
            success: true,
            userId: user._id,
            trialStartDate: trialStartDate,
            trialEndDate: trialEndDate,
            trialDurationHours,
            daysRemaining,
            message: `Reverse trial started! Enjoy ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} of premium.`
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
        
        // Look up stored duration from the device record (falls back to 7 days)
        let storedDurationHours = 168;
        const deviceRecord = await ReverseTrialDevice.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { deviceId: identifier },
                { userId: user._id }
            ]
        });
        if (deviceRecord?.trialDurationHours) {
            storedDurationHours = deviceRecord.trialDurationHours;
        }
        
        // Calculate trial status
        const now = new Date();
        const trialEndDate = new Date(user.reverseTrialStartDate.getTime() + storedDurationHours * 60 * 60 * 1000);
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
        
        const convertedAt = new Date();
        
        const user = await AppUser.findOneAndUpdate(
            query,
            {
                $set: {
                    reverseTrialConverted: true,
                    reverseTrialConvertedAt: convertedAt,
                    reverseTrialActive: false,
                    lastActiveAt: convertedAt,
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
        
        // Also update the device record to track conversion
        if (deviceId) {
            await ReverseTrialDevice.findOneAndUpdate(
                { deviceId },
                { 
                    $set: { 
                        converted: true, 
                        convertedAt: convertedAt 
                    } 
                }
            );
        }
        
        console.log('🎉 Reverse trial converted for user:', user._id);
        
        res.json({ 
            success: true,
            userId: user._id,
            convertedAt: convertedAt,
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

/**
 * PUT /api/app-user/timezone/:userId
 * Update user's timezone for daily notifications
 */
router.put('/timezone/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { timezone } = req.body;
        
        if (!timezone) {
            return res.status(400).json({ success: false, error: 'Timezone is required' });
        }
        
        // Validate timezone by trying to use it
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid timezone' });
        }
        
        const user = await AppUser.findOneAndUpdate(
            { $or: [{ _id: userId }, { deviceId: userId }, { email: userId }] },
            { $set: { timezone } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        console.log(`⏰ Timezone updated for user ${userId}: ${timezone}`);
        res.json({ success: true, timezone: user.timezone });
        
    } catch (error) {
        console.error('Error updating timezone:', error);
        res.status(500).json({ success: false, error: 'Failed to update timezone' });
    }
});

/**
 * PUT /api/app-user/notifications/:userId
 * Toggle daily notifications for a user
 */
router.put('/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { enabled, notificationTime } = req.body;
        
        const updateFields = {};
        if (typeof enabled === 'boolean') {
            updateFields.dailyNotificationDisabled = !enabled;
        }
        if (typeof notificationTime === 'number' && notificationTime >= 0 && notificationTime <= 23) {
            updateFields.dailyNotificationTime = notificationTime;
        }
        
        const user = await AppUser.findOneAndUpdate(
            { $or: [{ _id: userId }, { deviceId: userId }, { email: userId }] },
            { $set: updateFields },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        console.log(`🔔 Notifications ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
        res.json({ 
            success: true, 
            enabled: !user.dailyNotificationDisabled,
            notificationTime: user.dailyNotificationTime
        });
        
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update notification settings' });
    }
});

/**
 * GET /api/app-user/notification-settings/:userId
 * Get user's notification settings
 */
router.get('/notification-settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await AppUser.findOne(
            { $or: [{ _id: userId }, { deviceId: userId }, { email: userId }] }
        ).select('timezone dailyNotificationDisabled dailyNotificationTime oneSignalPlayerId');
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({
            success: true,
            settings: {
                timezone: user.timezone || 'America/New_York',
                enabled: !user.dailyNotificationDisabled,
                notificationTime: user.dailyNotificationTime || 8,
                hasOneSignal: !!user.oneSignalPlayerId,
            }
        });
        
    } catch (error) {
        console.error('Error getting notification settings:', error);
        res.status(500).json({ success: false, error: 'Failed to get notification settings' });
    }
});

/**
 * DELETE /api/app-user/by-email/:email
 * Delete an AppUser by email (for cleanup)
 */
router.delete('/by-email/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase().trim();
        const result = await AppUser.deleteOne({ email });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'AppUser not found' });
        }
        
        console.log(`🗑️ AppUser deleted: ${email}`);
        res.json({ success: true, message: 'AppUser deleted' });
    } catch (error) {
        console.error('Error deleting AppUser:', error);
        res.status(500).json({ success: false, error: 'Failed to delete' });
    }
});

module.exports = router;
