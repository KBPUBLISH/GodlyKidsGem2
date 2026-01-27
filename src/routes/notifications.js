const express = require('express');
const router = express.Router();
const OneSignal = require('onesignal-node');
const mongoose = require('mongoose');

// Auto Notification Settings Schema
const autoNotificationSettingsSchema = new mongoose.Schema({
    dailyReminder: {
        enabled: { type: Boolean, default: false },
        time: { type: String, default: '09:00' },
        title: { type: String, default: '🌟 Time to Learn!' },
        message: { type: String, default: 'Your daily adventure awaits! Open the app to continue your faith journey.' }
    },
    morningDevotional: {
        enabled: { type: Boolean, default: false },
        time: { type: String, default: '07:00' },
        title: { type: String, default: '☀️ Good Morning!' },
        message: { type: String, default: 'Start your day with today\'s devotional lesson. A new story is waiting!' }
    },
    eveningStory: {
        enabled: { type: Boolean, default: false },
        time: { type: String, default: '19:00' },
        title: { type: String, default: '🌙 Bedtime Story' },
        message: { type: String, default: 'Wind down with a calming Bible story before bed. Sweet dreams!' }
    },
    weeklyDigest: {
        enabled: { type: Boolean, default: false },
        dayOfWeek: { type: Number, default: 0 }, // 0 = Sunday
        time: { type: String, default: '10:00' },
        title: { type: String, default: '📊 Weekly Progress' },
        message: { type: String, default: 'See how much you\'ve learned this week! Check out your achievements.' }
    },
    inactivityReminder: {
        enabled: { type: Boolean, default: false },
        daysInactive: { type: Number, default: 3 },
        title: { type: String, default: '👋 We Miss You!' },
        message: { type: String, default: 'It\'s been a while! Your friends in Godly Kids are waiting for you.' }
    },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'autoNotificationSettings' });

// Check if model already exists to prevent recompilation error
const AutoNotificationSettings = mongoose.models.AutoNotificationSettings || mongoose.model('AutoNotificationSettings', autoNotificationSettingsSchema);

// Initialize OneSignal client
const getOneSignalClient = () => {
    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
        console.warn('⚠️ OneSignal credentials not configured');
        return null;
    }

    return new OneSignal.Client(appId, apiKey);
};

// POST /send - Send notification to all users or specific segments
router.post('/send', async (req, res) => {
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const {
            title,
            message,
            url,
            segments = ['All'], // Default to all users
            data = {},
            imageUrl,
            buttons
        } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }

        const notification = {
            headings: { en: title },
            contents: { en: message },
            included_segments: segments,
            data: data
        };

        // Optional: Add URL to open when notification is clicked
        if (url) {
            notification.url = url;
        }

        // Optional: Add big picture/image
        if (imageUrl) {
            notification.big_picture = imageUrl;
            notification.chrome_web_image = imageUrl;
        }

        // Optional: Add action buttons
        if (buttons && Array.isArray(buttons)) {
            notification.buttons = buttons;
        }

        const response = await client.createNotification(notification);
        
        console.log('✅ Notification sent:', response.body);
        res.json({
            success: true,
            id: response.body.id,
            recipients: response.body.recipients
        });

    } catch (error) {
        console.error('❌ Send notification error:', error);
        res.status(500).json({ 
            message: 'Failed to send notification', 
            error: error.message 
        });
    }
});

// POST /send-to-users - Send notification to specific users by external ID
router.post('/send-to-users', async (req, res) => {
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const {
            title,
            message,
            userIds, // Array of external user IDs
            url,
            data = {},
            imageUrl
        } = req.body;

        if (!title || !message || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: 'Title, message, and userIds array are required' });
        }

        const notification = {
            headings: { en: title },
            contents: { en: message },
            include_external_user_ids: userIds,
            data: data
        };

        if (url) {
            notification.url = url;
        }

        if (imageUrl) {
            notification.big_picture = imageUrl;
            notification.chrome_web_image = imageUrl;
        }

        const response = await client.createNotification(notification);
        
        console.log('✅ Notification sent to users:', response.body);
        res.json({
            success: true,
            id: response.body.id,
            recipients: response.body.recipients
        });

    } catch (error) {
        console.error('❌ Send notification to users error:', error);
        res.status(500).json({ 
            message: 'Failed to send notification', 
            error: error.message 
        });
    }
});

// POST /send-to-players - Send notification to specific player IDs
router.post('/send-to-players', async (req, res) => {
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const {
            title,
            message,
            playerIds, // Array of OneSignal player IDs
            url,
            data = {},
            imageUrl
        } = req.body;

        if (!title || !message || !playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
            return res.status(400).json({ message: 'Title, message, and playerIds array are required' });
        }

        const notification = {
            headings: { en: title },
            contents: { en: message },
            include_player_ids: playerIds,
            data: data
        };

        if (url) {
            notification.url = url;
        }

        if (imageUrl) {
            notification.big_picture = imageUrl;
            notification.chrome_web_image = imageUrl;
        }

        const response = await client.createNotification(notification);
        
        console.log('✅ Notification sent to players:', response.body);
        res.json({
            success: true,
            id: response.body.id,
            recipients: response.body.recipients
        });

    } catch (error) {
        console.error('❌ Send notification to players error:', error);
        res.status(500).json({ 
            message: 'Failed to send notification', 
            error: error.message 
        });
    }
});

// GET /segments - Get available segments
router.get('/segments', async (req, res) => {
    // Return common segments - OneSignal doesn't have a direct API for this
    // These are the default segments available in OneSignal
    res.json([
        { id: 'All', name: 'All Users', description: 'Send to all subscribed users' },
        { id: 'Active Users', name: 'Active Users', description: 'Users who have been active recently' },
        { id: 'Inactive Users', name: 'Inactive Users', description: 'Users who haven\'t been active recently' },
        { id: 'Engaged Users', name: 'Engaged Users', description: 'Highly engaged users' }
    ]);
});

// POST /schedule - Schedule a notification for later
router.post('/schedule', async (req, res) => {
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const {
            title,
            message,
            sendAt, // ISO date string
            segments = ['All'],
            url,
            data = {}
        } = req.body;

        if (!title || !message || !sendAt) {
            return res.status(400).json({ message: 'Title, message, and sendAt are required' });
        }

        const notification = {
            headings: { en: title },
            contents: { en: message },
            included_segments: segments,
            send_after: sendAt,
            data: data
        };

        if (url) {
            notification.url = url;
        }

        const response = await client.createNotification(notification);
        
        console.log('✅ Notification scheduled:', response.body);
        res.json({
            success: true,
            id: response.body.id,
            scheduledFor: sendAt
        });

    } catch (error) {
        console.error('❌ Schedule notification error:', error);
        res.status(500).json({ 
            message: 'Failed to schedule notification', 
            error: error.message 
        });
    }
});

// DELETE /:id - Cancel a scheduled notification
router.delete('/:id', async (req, res) => {
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const { id } = req.params;

        const response = await client.cancelNotification(id);
        
        console.log('✅ Notification cancelled:', id);
        res.json({
            success: true,
            message: 'Notification cancelled'
        });

    } catch (error) {
        console.error('❌ Cancel notification error:', error);
        res.status(500).json({ 
            message: 'Failed to cancel notification', 
            error: error.message 
        });
    }
});

// GET /auto-settings - Get automatic notification settings
router.get('/auto-settings', async (req, res) => {
    try {
        // Get the single settings document (or create default if none exists)
        let settings = await AutoNotificationSettings.findOne();
        
        if (!settings) {
            // Return default settings
            settings = {
                dailyReminder: {
                    enabled: false,
                    time: '09:00',
                    title: '🌟 Time to Learn!',
                    message: 'Your daily adventure awaits! Open the app to continue your faith journey.'
                },
                morningDevotional: {
                    enabled: false,
                    time: '07:00',
                    title: '☀️ Good Morning!',
                    message: 'Start your day with today\'s devotional lesson. A new story is waiting!'
                },
                eveningStory: {
                    enabled: false,
                    time: '19:00',
                    title: '🌙 Bedtime Story',
                    message: 'Wind down with a calming Bible story before bed. Sweet dreams!'
                },
                weeklyDigest: {
                    enabled: false,
                    dayOfWeek: 0,
                    time: '10:00',
                    title: '📊 Weekly Progress',
                    message: 'See how much you\'ve learned this week! Check out your achievements.'
                },
                inactivityReminder: {
                    enabled: false,
                    daysInactive: 3,
                    title: '👋 We Miss You!',
                    message: 'It\'s been a while! Your friends in Godly Kids are waiting for you.'
                }
            };
        }
        
        res.json({ success: true, settings });
    } catch (error) {
        console.error('❌ Get auto settings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get auto notification settings', 
            error: error.message 
        });
    }
});

// POST /auto-settings - Save automatic notification settings
router.post('/auto-settings', async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings) {
            return res.status(400).json({ 
                success: false, 
                message: 'Settings object is required' 
            });
        }

        // Update or create the settings document
        const updatedSettings = await AutoNotificationSettings.findOneAndUpdate(
            {}, // Match any document (we only have one)
            {
                $set: {
                    ...settings,
                    updatedAt: new Date()
                }
            },
            { 
                upsert: true, // Create if doesn't exist
                new: true,    // Return the updated document
                runValidators: true
            }
        );
        
        console.log('✅ Auto notification settings saved');
        res.json({ 
            success: true, 
            message: 'Auto notification settings saved successfully',
            settings: updatedSettings
        });
    } catch (error) {
        console.error('❌ Save auto settings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to save auto notification settings', 
            error: error.message 
        });
    }
});

// GET /history - Get notification history with stats
router.get('/history', async (req, res) => {
    try {
        const appId = process.env.ONESIGNAL_APP_ID;
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;

        if (!appId || !apiKey) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Fetch notifications from OneSignal REST API
        const response = await fetch(
            `https://onesignal.com/api/v1/notifications?app_id=${appId}&limit=${limit}&offset=${offset}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('OneSignal API error:', error);
            return res.status(response.status).json({ 
                message: 'Failed to fetch notifications from OneSignal',
                error 
            });
        }

        const data = await response.json();
        
        // Transform the data to include relevant stats
        const notifications = (data.notifications || []).map(n => ({
            id: n.id,
            heading: n.headings?.en || 'No title',
            contents: n.contents?.en || 'No content',
            successful: n.successful || 0,
            failed: n.failed || 0,
            converted: n.converted || 0, // Clicks/opens
            remaining: n.remaining || 0,
            queued_at: n.queued_at,
            completed_at: n.completed_at,
            platform_delivery_stats: n.platform_delivery_stats
        }));

        res.json({
            success: true,
            notifications,
            total_count: data.total_count || notifications.length
        });

    } catch (error) {
        console.error('❌ Get notification history error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get notification history', 
            error: error.message 
        });
    }
});

// GET /stats/:id - Get detailed stats for a specific notification
router.get('/stats/:id', async (req, res) => {
    try {
        const appId = process.env.ONESIGNAL_APP_ID;
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;

        if (!appId || !apiKey) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const { id } = req.params;

        const response = await fetch(
            `https://onesignal.com/api/v1/notifications/${id}?app_id=${appId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return res.status(response.status).json({ 
                message: 'Failed to fetch notification stats',
                error 
            });
        }

        const data = await response.json();
        
        res.json({
            success: true,
            notification: {
                id: data.id,
                heading: data.headings?.en || 'No title',
                contents: data.contents?.en || 'No content',
                successful: data.successful || 0,
                failed: data.failed || 0,
                errored: data.errored || 0,
                converted: data.converted || 0,
                remaining: data.remaining || 0,
                queued_at: data.queued_at,
                send_after: data.send_after,
                completed_at: data.completed_at,
                canceled: data.canceled,
                platform_delivery_stats: data.platform_delivery_stats,
                // Outcomes data if available
                outcomes: data.outcomes
            }
        });

    } catch (error) {
        console.error('❌ Get notification stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get notification stats', 
            error: error.message 
        });
    }
});

// POST /send-auto - Trigger an automatic notification (called by scheduler/cron)
// DISABLED: Automatic notifications are currently disabled to prevent duplicates
// Re-enable when proper deduplication is implemented
router.post('/send-auto', async (req, res) => {
    console.log('⚠️ Auto notification endpoint called but is DISABLED');
    return res.status(503).json({ 
        success: false, 
        message: 'Automatic notifications are currently disabled. Use manual notifications from the portal instead.' 
    });
    
    /* DISABLED - Original implementation:
    try {
        const client = getOneSignalClient();
        if (!client) {
            return res.status(500).json({ message: 'OneSignal not configured' });
        }

        const { type, timezone } = req.body; // type: 'dailyReminder', 'morningDevotional', etc.
        
        const settings = await AutoNotificationSettings.findOne();
        if (!settings || !settings[type] || !settings[type].enabled) {
            return res.status(400).json({ 
                success: false, 
                message: `Auto notification type '${type}' is not enabled` 
            });
        }

        const notificationConfig = settings[type];
        
        // Build notification with timezone-aware delivery
        const notification = {
            headings: { en: notificationConfig.title },
            contents: { en: notificationConfig.message },
            included_segments: ['All'],
            // Use delayed_option to send at user's local time
            delayed_option: 'timezone',
            delivery_time_of_day: notificationConfig.time + ':00' // Format: "09:00:00"
        };

        const response = await client.createNotification(notification);
        
        console.log(`✅ Auto notification '${type}' scheduled:`, response.body);
        res.json({
            success: true,
            type,
            id: response.body.id,
            recipients: response.body.recipients
        });

    } catch (error) {
        console.error('❌ Send auto notification error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to send auto notification', 
            error: error.message 
        });
    }
    */
});

module.exports = router;



