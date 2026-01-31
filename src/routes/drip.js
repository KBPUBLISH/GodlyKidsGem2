const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const AppUser = require('../models/AppUser');

// Admin API key for protected job endpoints
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.MIGRATION_API_KEY;

// Initialize nodemailer transporter lazily
let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;
    
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
        console.warn('⚠️ EMAIL_USER or EMAIL_PASSWORD not configured - drip emails disabled');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPassword
        }
    });
    
    console.log('✅ Email transporter initialized for drip campaigns');
    return transporter;
};

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

// Email templates for drip campaign
const DRIP_EMAILS = {
    day0_welcome: {
        subject: "Welcome to Godly Kids! 🙏",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Welcome to the family, ${firstName}! 🎉</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    I'm Michael, the founder of Godly Kids. Thank you SO much for joining us — it means the world to me!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    I created this app because I believe building faith habits with your kids shouldn't be complicated. Just <strong>5 minutes a day</strong> can plant seeds that last a lifetime.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Here's how to get started:
                </p>
                
                <ol style="color: #333; line-height: 1.8;">
                    <li>Open the app and create a profile for each child</li>
                    <li>Pick a Bible story to start with</li>
                    <li>Make it a daily habit — morning, after school, or bedtime!</li>
                </ol>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Open Godly Kids
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    Hit reply anytime — I read every email personally.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael Bouchard</strong><br>
                    <span style="color: #666;">Founder, Godly Kids</span>
                </p>
            </div>
        `
    },
    
    day2_tips: {
        subject: "Quick tip: Here's what families love most 💡",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Hey ${firstName}! 👋</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    Hope you've had a chance to explore Godly Kids! I wanted to share what other families tell us they love most:
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>🎧 Audio Stories</strong> — Kids can listen while you cook dinner or drive. No screen required!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>🎮 Bible Games</strong> — Learning scripture through play, not lectures. Kids actually ASK to play these.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>📊 Parent Dashboard</strong> — See what your kids learned without hovering. Perfect for busy parents.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>Pro tip:</strong> Set a specific time each day. Consistency beats perfection. Even 5 minutes builds the habit!
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Continue Your Journey
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael</strong>
                </p>
            </div>
        `
    },
    
    day4_features: {
        subject: "Have you tried this yet? 🎯",
        getHtml: (firstName) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">${firstName}, quick question...</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    Have your kids tried the <strong>Memory Verse Games</strong> yet?
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Parents tell us their kids end up memorizing Scripture without even realizing they're "learning." The games make it feel like play, not homework.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    One mom told me: <em>"My 6-year-old randomly quoted Philippians 4:13 at dinner. I almost cried!"</em>
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    That's the goal — faith becoming natural, not forced.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Try Memory Verse Games
                    </a>
                </div>
                
                <p style="color: #333; line-height: 1.6;">
                    How's it going so far? I'd love to hear!
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    — Michael
                </p>
            </div>
        `
    },
    
    day6_checkin: {
        subject: "How's it going, ${firstName}? 💬",
        getHtml: (firstName, isTrialUser) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">Hey ${firstName}!</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    It's been almost a week since you joined Godly Kids. I wanted to personally check in.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    <strong>How's it going?</strong> Are your kids enjoying it? Is there anything confusing or missing?
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    I genuinely want to hear your honest feedback — the good AND the bad. It helps me make this better for families like yours.
                </p>
                
                ${isTrialUser ? `
                <p style="color: #333; line-height: 1.6; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>Quick heads up:</strong> Your trial is ending soon. If Godly Kids has been helpful, I'd love for you to stick around! If not, no pressure — just hit reply and tell me what would make it worth it.
                </p>
                ` : ''}
                
                <p style="color: #333; line-height: 1.6;">
                    Just hit reply — I read every email.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless your family,<br>
                    <strong>Michael</strong>
                </p>
            </div>
        `
    },
    
    day7_final: {
        subject: "One last thing... 🙏",
        getHtml: (firstName, isTrialUser) => `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">${firstName}, thank you.</h2>
                
                <p style="color: #333; line-height: 1.6;">
                    I just wanted to say thank you for giving Godly Kids a try this week.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    Building a faith-filled home isn't easy. The world is loud, life is busy, and sometimes it feels impossible to compete for your kids' attention.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    But here's what I believe: <strong>80% of kids raised in church leave the faith by 18.</strong> The difference-maker? Daily faith habits at home.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    That's why I built this. Not to replace church or family Bible time — but to make it easier for busy parents like you to build those habits, even on the craziest days.
                </p>
                
                ${isTrialUser ? `
                <p style="color: #333; line-height: 1.6;">
                    If you've found value in Godly Kids, I'd be honored to have your family continue with us. 
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Continue Your Subscription
                    </a>
                </div>
                ` : `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://godlykids.app" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Open Godly Kids
                    </a>
                </div>
                `}
                
                <p style="color: #333; line-height: 1.6;">
                    Either way, thank you for trusting us with your family. I'm praying for you.
                </p>
                
                <p style="color: #333; line-height: 1.6;">
                    God bless,<br>
                    <strong>Michael Bouchard</strong><br>
                    <span style="color: #666;">Founder, Godly Kids</span>
                </p>
            </div>
        `
    }
};

/**
 * Calculate which drip email a user should receive based on signup date
 */
function getDripStage(createdAt, emailsSent = {}) {
    const now = new Date();
    const signupDate = new Date(createdAt);
    const daysSinceSignup = Math.floor((now - signupDate) / (1000 * 60 * 60 * 24));
    
    // Check which email to send based on days and what's already been sent
    if (daysSinceSignup >= 0 && !emailsSent.day0_welcome) return 'day0_welcome';
    if (daysSinceSignup >= 2 && !emailsSent.day2_tips) return 'day2_tips';
    if (daysSinceSignup >= 4 && !emailsSent.day4_features) return 'day4_features';
    if (daysSinceSignup >= 6 && !emailsSent.day6_checkin) return 'day6_checkin';
    if (daysSinceSignup >= 7 && !emailsSent.day7_final) return 'day7_final';
    
    return null; // No email needed
}

/**
 * POST /api/drip/run
 * Process drip campaign - send appropriate emails based on user signup date
 * Run this daily via cron
 */
router.post('/run', verifyAdminKey, async (req, res) => {
    console.log('📧 Running drip campaign...');
    
    // Check if email is configured
    const transport = getTransporter();
    if (!transport) {
        return res.status(503).json({
            success: false,
            error: 'Email service not configured (EMAIL_USER/EMAIL_PASSWORD missing)',
        });
    }
    
    try {
        const { limit = 100 } = req.body;
        
        // Find users who:
        // 1. Have an email
        // 2. Created account in the last 8 days (drip window)
        // 3. Haven't completed the drip sequence
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        
        const users = await AppUser.find({
            email: { $exists: true, $ne: null, $ne: '' },
            createdAt: { $gte: eightDaysAgo },
            dripCompleted: { $ne: true }
        })
        .select('email parentName createdAt subscriptionStatus reverseTrialActive dripEmailsSent')
        .limit(limit)
        .lean();
        
        console.log(`Found ${users.length} users in drip window`);
        
        const results = {
            processed: 0,
            emailsSent: 0,
            byStage: {},
            errors: []
        };
        
        for (const user of users) {
            const stage = getDripStage(user.createdAt, user.dripEmailsSent || {});
            
            if (!stage) {
                // Check if drip is complete
                const sent = user.dripEmailsSent || {};
                if (sent.day7_final) {
                    await AppUser.updateOne(
                        { _id: user._id },
                        { $set: { dripCompleted: true } }
                    );
                }
                continue;
            }
            
            results.processed++;
            
            try {
                const firstName = user.parentName?.split(' ')[0] || 'friend';
                const template = DRIP_EMAILS[stage];
                const isTrialUser = user.subscriptionStatus === 'trial' || 
                                   user.subscriptionStatus === 'reverse_trial' || 
                                   user.reverseTrialActive;
                
                // Get HTML (some templates need isTrialUser param)
                const html = template.getHtml.length > 1 
                    ? template.getHtml(firstName, isTrialUser)
                    : template.getHtml(firstName);
                
                const subject = template.subject.replace('${firstName}', firstName);
                const fromEmail = process.env.EMAIL_USER || 'hello@kbpublish.org';
                
                await transport.sendMail({
                    from: `Michael from Godly Kids <${fromEmail}>`,
                    replyTo: 'hello@kbpublish.org',
                    to: user.email,
                    subject: subject,
                    html: html
                });
                
                // Mark this email as sent
                await AppUser.updateOne(
                    { _id: user._id },
                    { 
                        $set: { 
                            [`dripEmailsSent.${stage}`]: new Date(),
                            lastDripEmailAt: new Date()
                        } 
                    }
                );
                
                results.emailsSent++;
                results.byStage[stage] = (results.byStage[stage] || 0) + 1;
                
            } catch (emailError) {
                console.error(`Failed to send ${stage} to ${user.email}:`, emailError.message);
                results.errors.push({
                    email: user.email,
                    stage,
                    error: emailError.message
                });
            }
        }
        
        console.log(`📧 Drip complete: ${results.emailsSent} emails sent`);
        console.log('By stage:', results.byStage);
        
        res.json({
            success: true,
            ...results
        });
        
    } catch (error) {
        console.error('Error running drip campaign:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drip/status
 * Check drip campaign status
 */
router.get('/status', verifyAdminKey, async (req, res) => {
    try {
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        
        const inDripWindow = await AppUser.countDocuments({
            email: { $exists: true, $ne: null, $ne: '' },
            createdAt: { $gte: eightDaysAgo },
            dripCompleted: { $ne: true }
        });
        
        const completed = await AppUser.countDocuments({
            dripCompleted: true
        });
        
        res.json({
            status: 'ok',
            usersInDripWindow: inDripWindow,
            completedDripSequence: completed,
            stages: ['day0_welcome', 'day2_tips', 'day4_features', 'day6_checkin', 'day7_final']
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
