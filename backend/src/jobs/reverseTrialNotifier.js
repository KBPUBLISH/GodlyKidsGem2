/**
 * Reverse Trial Notifier Job
 * 
 * This job runs periodically to send reminder notifications to users
 * whose reverse trial is about to expire.
 * 
 * Notifications are sent at:
 * - 3 days remaining
 * - 2 days remaining  
 * - 1 day remaining
 * 
 * Usage:
 * - Can be called manually via POST /api/jobs/reverse-trial-notifications
 * - Should be set up as a cron job to run every few hours
 */

const AppUser = require('../models/AppUser');
const ReverseTrialDevice = require('../models/ReverseTrialDevice');
const { sendNotificationByPlayerId, sendNotificationToUser } = require('../services/notificationService');

// Trial duration in days
const TRIAL_DAYS = 7;

// Notification thresholds (days remaining)
const NOTIFICATION_THRESHOLDS = [3, 2, 1];

/**
 * Get notification content based on days remaining
 */
function getNotificationContent(daysRemaining, userName) {
    const name = userName || 'there';
    
    if (daysRemaining === 3) {
        return {
            title: '⏰ 3 Days Left on Your Trial!',
            message: `Hey ${name}! Your premium access ends in 3 days. Don't lose your reading progress and unlocked content!`,
            data: { type: 'reverse_trial_reminder', daysRemaining: 3 }
        };
    } else if (daysRemaining === 2) {
        return {
            title: '⚠️ Only 2 Days Left!',
            message: `${name}, your kids' favorite stories and features are almost gone! Subscribe now to keep the fun going.`,
            data: { type: 'reverse_trial_reminder', daysRemaining: 2 }
        };
    } else if (daysRemaining === 1) {
        return {
            title: '🚨 Last Day of Your Trial!',
            message: `${name}, this is it! Your premium access ends tomorrow. Subscribe today to keep all your progress!`,
            data: { type: 'reverse_trial_reminder', daysRemaining: 1 }
        };
    }
    
    return null;
}

/**
 * Calculate days remaining in trial
 */
function getDaysRemaining(trialStartDate) {
    const now = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const msRemaining = trialEndDate - now;
    return Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
}

/**
 * Send notification to a user
 */
async function sendReminderNotification(user, daysRemaining) {
    const content = getNotificationContent(daysRemaining, user.parentName);
    
    if (!content) {
        return { success: false, reason: 'Invalid days remaining' };
    }
    
    // Try OneSignal player ID first, then fall back to user ID
    if (user.oneSignalPlayerId) {
        const result = await sendNotificationByPlayerId({
            playerId: user.oneSignalPlayerId,
            ...content
        });
        return { success: !!result, method: 'playerId' };
    } else {
        const result = await sendNotificationToUser({
            userId: user._id.toString(),
            ...content
        });
        return { success: !!result, method: 'userId' };
    }
}

/**
 * Process a single user for trial notifications
 */
async function processUser(user) {
    const daysRemaining = getDaysRemaining(user.reverseTrialStartDate);
    
    // Skip if trial has ended or too many days left
    if (daysRemaining <= 0 || daysRemaining > 3) {
        return { userId: user._id, skipped: true, reason: daysRemaining <= 0 ? 'Trial ended' : 'Too early' };
    }
    
    // Check which notification to send based on days remaining
    const notificationsSent = user.reverseTrialNotificationsSent || {};
    
    let notificationToSend = null;
    let notificationKey = null;
    
    if (daysRemaining <= 1 && !notificationsSent.oneDay) {
        notificationToSend = 1;
        notificationKey = 'oneDay';
    } else if (daysRemaining <= 2 && !notificationsSent.twoDays) {
        notificationToSend = 2;
        notificationKey = 'twoDays';
    } else if (daysRemaining <= 3 && !notificationsSent.threeDays) {
        notificationToSend = 3;
        notificationKey = 'threeDays';
    }
    
    if (!notificationToSend) {
        return { userId: user._id, skipped: true, reason: 'Notification already sent' };
    }
    
    // Send the notification
    const sendResult = await sendReminderNotification(user, notificationToSend);
    
    if (sendResult.success) {
        // Mark notification as sent
        await AppUser.findByIdAndUpdate(user._id, {
            $set: {
                [`reverseTrialNotificationsSent.${notificationKey}`]: true
            }
        });
        
        console.log(`📬 Sent ${notificationToSend}-day reminder to user ${user._id} (${user.email || user.deviceId})`);
        
        return { 
            userId: user._id, 
            sent: true, 
            daysRemaining: notificationToSend,
            method: sendResult.method
        };
    } else {
        return { 
            userId: user._id, 
            sent: false, 
            reason: 'Notification failed',
            daysRemaining: notificationToSend
        };
    }
}

/**
 * Run the reverse trial notification job
 */
async function runReverseTrialNotifications() {
    console.log('🔔 Starting reverse trial notification job...');
    
    const startTime = Date.now();
    const results = {
        total: 0,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        byDays: { 3: 0, 2: 0, 1: 0 }
    };
    
    try {
        // Find all users with active reverse trials who haven't converted
        const activeTrialUsers = await AppUser.find({
            reverseTrialActive: true,
            reverseTrialConverted: { $ne: true },
            reverseTrialStartDate: { $exists: true },
        }).select('_id email deviceId parentName oneSignalPlayerId reverseTrialStartDate reverseTrialNotificationsSent');
        
        results.total = activeTrialUsers.length;
        console.log(`📊 Found ${activeTrialUsers.length} users with active reverse trials`);
        
        // Process users in batches
        const BATCH_SIZE = 20;
        const DELAY_BETWEEN_BATCHES = 1000; // 1 second
        
        for (let i = 0; i < activeTrialUsers.length; i += BATCH_SIZE) {
            const batch = activeTrialUsers.slice(i, i + BATCH_SIZE);
            
            const batchResults = await Promise.all(
                batch.map(user => processUser(user))
            );
            
            // Tally results
            for (const result of batchResults) {
                results.processed++;
                
                if (result.skipped) {
                    results.skipped++;
                } else if (result.sent) {
                    results.sent++;
                    if (result.daysRemaining) {
                        results.byDays[result.daysRemaining]++;
                    }
                } else {
                    results.failed++;
                }
            }
            
            // Delay between batches
            if (i + BATCH_SIZE < activeTrialUsers.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✨ Reverse trial notification job completed in ${duration}s`);
        console.log(`   Total: ${results.total}, Processed: ${results.processed}, Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
        console.log(`   By days - 3-day: ${results.byDays[3]}, 2-day: ${results.byDays[2]}, 1-day: ${results.byDays[1]}`);
        
        return {
            success: true,
            duration: `${duration}s`,
            ...results,
        };
        
    } catch (error) {
        console.error('❌ Reverse trial notification job failed:', error);
        return {
            success: false,
            error: error.message,
            ...results,
        };
    }
}

/**
 * Check and expire reverse trials that have ended
 */
async function expireEndedTrials() {
    console.log('⏰ Checking for expired reverse trials...');
    
    const now = new Date();
    const trialEndCutoff = new Date(now.getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000);
    
    try {
        // Find users whose trial started more than 7 days ago and is still marked active
        const expiredTrials = await AppUser.find({
            reverseTrialActive: true,
            reverseTrialConverted: { $ne: true },
            reverseTrialStartDate: { $lte: trialEndCutoff },
        });
        
        let expiredCount = 0;
        
        for (const user of expiredTrials) {
            await AppUser.findByIdAndUpdate(user._id, {
                $set: {
                    reverseTrialActive: false,
                    subscriptionStatus: 'expired',
                }
            });
            
            expiredCount++;
            console.log(`⏰ Expired reverse trial for user ${user._id}`);
        }
        
        console.log(`✅ Expired ${expiredCount} reverse trials`);
        
        return { success: true, expiredCount };
        
    } catch (error) {
        console.error('❌ Error expiring trials:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get reverse trial analytics
 */
async function getReverseTrialAnalytics() {
    try {
        const now = new Date();
        
        // Total users who started reverse trial
        const totalStarted = await AppUser.countDocuments({
            reverseTrialStartDate: { $exists: true }
        });
        
        // Currently active trials
        const activeTrials = await AppUser.countDocuments({
            reverseTrialActive: true,
            reverseTrialConverted: { $ne: true }
        });
        
        // Converted (success!)
        const converted = await AppUser.countDocuments({
            reverseTrialConverted: true
        });
        
        // Expired without converting
        const expired = await AppUser.countDocuments({
            reverseTrialStartDate: { $exists: true },
            reverseTrialActive: false,
            reverseTrialConverted: { $ne: true }
        });
        
        // Conversion rate
        const conversionRate = totalStarted > 0 ? Math.round((converted / totalStarted) * 100) : 0;
        
        // Device-based stats
        const deviceStats = await ReverseTrialDevice.aggregate([
            {
                $group: {
                    _id: null,
                    totalDevices: { $sum: 1 },
                    convertedDevices: { $sum: { $cond: ['$converted', 1, 0] } },
                }
            }
        ]);
        
        const deviceData = deviceStats[0] || { totalDevices: 0, convertedDevices: 0 };
        
        return {
            success: true,
            stats: {
                totalStarted,
                activeTrials,
                converted,
                expired,
                conversionRate,
                devices: {
                    total: deviceData.totalDevices,
                    converted: deviceData.convertedDevices,
                }
            }
        };
        
    } catch (error) {
        console.error('Error getting reverse trial analytics:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    runReverseTrialNotifications,
    expireEndedTrials,
    getReverseTrialAnalytics,
    processUser, // Exported for testing
    getDaysRemaining,
};
