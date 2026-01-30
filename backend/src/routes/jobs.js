const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const { runSubscriptionCheck } = require('../jobs/subscriptionChecker');
const AppUser = require('../models/AppUser');

// Admin API key for protected job endpoints
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.MIGRATION_API_KEY;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Middleware to verify admin API key
 */
const verifyAdminKey = (req, res, next) => {
    const apiKey = req.headers['x-admin-api-key'] || req.headers['x-migration-api-key'];
    
    if (!ADMIN_API_KEY) {
        return res.status(500).json({ error: 'Admin API key not configured' });
    }

    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Invalid or missing admin API key' });
    }

    next();
};

/**
 * POST /api/jobs/check-subscriptions
 * Manually trigger the subscription check job
 * Requires X-Admin-API-Key header
 */
router.post('/check-subscriptions', verifyAdminKey, async (req, res) => {
    console.log('📋 Subscription check job triggered manually');

    try {
        const result = await runSubscriptionCheck();
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Subscription check completed',
                ...result,
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Subscription check failed',
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error running subscription check:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/jobs/send-reengagement
 * Send re-engagement emails to inactive users
 * Requires X-Admin-API-Key header
 * 
 * Body params:
 * - daysInactive: number (default 7) - users inactive for this many days
 * - limit: number (default 50) - max emails to send per run
 */
router.post('/send-reengagement', verifyAdminKey, async (req, res) => {
    console.log('📧 Re-engagement email job triggered');

    try {
        const { daysInactive = 7, limit = 50 } = req.body;
        
        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

        // Find users who:
        // 1. Have an email
        // 2. Haven't been active since cutoff date
        // 3. Are not currently subscribed (focus on free/expired users)
        const inactiveUsers = await AppUser.find({
            email: { $exists: true, $ne: null, $ne: '' },
            lastActiveAt: { $lt: cutoffDate },
            subscriptionStatus: { $in: ['free', 'expired', 'cancelled'] },
        })
        .select('email parentName lastActiveAt subscriptionStatus')
        .limit(limit)
        .lean();

        console.log(`Found ${inactiveUsers.length} inactive users to email`);

        if (inactiveUsers.length === 0) {
            return res.json({
                success: true,
                message: 'No inactive users found matching criteria',
                emailsSent: 0,
                daysInactive,
            });
        }

        // Send emails
        const results = {
            sent: 0,
            failed: 0,
            errors: [],
        };

        for (const user of inactiveUsers) {
            try {
                const firstName = user.parentName?.split(' ')[0] || 'there';
                
                await resend.emails.send({
                    from: 'Godly Kids <hello@godlykids.app>',
                    to: user.email,
                    subject: `${firstName}, your family's faith journey is waiting! 🙏`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #1a1a2e;">Hey ${firstName}! 👋</h2>
                            
                            <p style="color: #333; line-height: 1.6;">
                                We noticed you haven't opened Godly Kids in a while, and we wanted to check in.
                            </p>
                            
                            <p style="color: #333; line-height: 1.6;">
                                Building a daily faith habit with your kids doesn't have to be hard — even just <strong>5 minutes a day</strong> can make a lasting impact on their spiritual foundation.
                            </p>
                            
                            <p style="color: #333; line-height: 1.6;">
                                Here's what's waiting for you:
                            </p>
                            
                            <ul style="color: #333; line-height: 1.8;">
                                <li>📖 New Bible stories and devotionals</li>
                                <li>🎮 Fun games that teach Scripture</li>
                                <li>🎵 Worship music your kids will love</li>
                                <li>✨ Daily lessons designed for busy families</li>
                            </ul>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                    Open Godly Kids
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                Your kids are watching and learning every day. Let's make sure they're learning what matters most. 💜
                            </p>
                            
                            <p style="color: #333;">
                                — The Godly Kids Team
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                You're receiving this because you signed up for Godly Kids.<br>
                                <a href="https://godlykids.app/unsubscribe" style="color: #999;">Unsubscribe</a>
                            </p>
                        </div>
                    `,
                });
                
                results.sent++;
            } catch (emailError) {
                console.error(`Failed to send email to ${user.email}:`, emailError.message);
                results.failed++;
                results.errors.push({
                    email: user.email,
                    error: emailError.message,
                });
            }
        }

        console.log(`📧 Re-engagement complete: ${results.sent} sent, ${results.failed} failed`);

        res.json({
            success: true,
            message: `Re-engagement emails sent`,
            emailsSent: results.sent,
            emailsFailed: results.failed,
            daysInactive,
            errors: results.errors.length > 0 ? results.errors : undefined,
        });

    } catch (error) {
        console.error('Error running re-engagement job:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/jobs/status
 * Check if job routes are working
 */
router.get('/status', (req, res) => {
    res.json({
        status: 'ok',
        availableJobs: [
            {
                name: 'check-subscriptions',
                method: 'POST',
                path: '/api/jobs/check-subscriptions',
                description: 'Check subscription status for migrated users',
                requiresAuth: true,
            },
            {
                name: 'send-reengagement',
                method: 'POST',
                path: '/api/jobs/send-reengagement',
                description: 'Send re-engagement emails to inactive users',
                requiresAuth: true,
                params: {
                    daysInactive: 'number (default 7)',
                    limit: 'number (default 50)',
                },
            }
        ],
    });
});

module.exports = router;


