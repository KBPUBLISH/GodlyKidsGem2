const nodemailer = require('nodemailer');

// Initialize Gmail transporter lazily
let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;
    
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    console.log('📧 Checking email config...');
    console.log('📧 EMAIL_USER:', emailUser ? `${emailUser.substring(0, 5)}...` : 'NOT SET');
    console.log('📧 EMAIL_PASSWORD:', emailPassword ? 'SET (hidden)' : 'NOT SET');
    
    if (!emailUser || !emailPassword) {
        console.warn('⚠️ EMAIL_USER or EMAIL_PASSWORD not configured - emails disabled');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPassword
        }
    });
    
    console.log('✅ Gmail email transporter initialized for:', emailUser);
    return transporter;
};

/**
 * Send a password reset email
 */
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
    const transport = getTransporter();
    
    if (!transport) {
        console.log('📧 Email skipped (Gmail not configured). Reset token:', resetToken);
        return { success: false, error: 'Email service not configured' };
    }
    
    try {
        const fromEmail = process.env.EMAIL_USER || 'hello@kbpublish.org';
        const supportEmail = process.env.SUPPORT_EMAIL || 'hello@kbpublish.org';
        
        const mailOptions = {
            from: `GodlyKids <${fromEmail}>`,
            to: email,
            subject: '🔐 Reset Your GodlyKids Password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, #5c3d2e 0%, #3e2a1e 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 30px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #FFD700; font-size: 28px; font-weight: bold;">GodlyKids</h1>
                            <p style="margin: 5px 0 0; color: #eecaa0; font-size: 14px;">Faith-filled adventures for kids! 🌟</p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: rgba(255,255,255,0.95); border-radius: 15px; padding: 30px; text-align: center;">
                                <div style="font-size: 50px; margin-bottom: 15px;">🔐</div>
                                <h2 style="margin: 0 0 15px; color: #3e2a1e; font-size: 22px;">Password Reset Request</h2>
                                <p style="margin: 0 0 25px; color: #5c3d2e; font-size: 15px; line-height: 1.6;">
                                    We received a request to reset your password. Click the button below to create a new password.
                                </p>
                                
                                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #3e2a1e; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(255,215,0,0.4);">
                                    Reset Password
                                </a>
                                
                                <p style="margin: 25px 0 0; color: #8B4513; font-size: 13px;">
                                    This link expires in <strong>1 hour</strong>.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Security Notice -->
                    <tr>
                        <td style="padding: 0 30px 20px;">
                            <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 15px;">
                                <p style="margin: 0; color: #eecaa0; font-size: 12px; text-align: center;">
                                    🛡️ Didn't request this? You can safely ignore this email.<br>
                                    Your password will remain unchanged.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
                            <p style="margin: 0 0 10px; color: #eecaa0; font-size: 13px;">
                                Need help? Contact us at<br>
                                <a href="mailto:${supportEmail}" style="color: #FFD700;">${supportEmail}</a>
                            </p>
                            <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 11px;">
                                © ${new Date().getFullYear()} GodlyKids. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `,
            text: `
GodlyKids Password Reset

We received a request to reset your password.

Click this link to reset your password:
${resetUrl}

This link expires in 1 hour.

Didn't request this? You can safely ignore this email. Your password will remain unchanged.

Need help? Contact us at ${supportEmail}

© ${new Date().getFullYear()} GodlyKids
            `.trim()
        };
        
        const info = await transport.sendMail(mailOptions);
        
        console.log('✅ Password reset email sent to:', email, 'MessageId:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send a welcome email after signup
 */
const sendWelcomeEmail = async (email, name) => {
    const transport = getTransporter();
    
    if (!transport) {
        console.log('📧 Welcome email skipped (Gmail not configured)');
        return { success: false, error: 'Email service not configured' };
    }
    
    try {
        const fromEmail = process.env.EMAIL_USER || 'hello@kbpublish.org';
        
        const mailOptions = {
            from: `GodlyKids <${fromEmail}>`,
            to: email,
            subject: '🎉 Welcome to GodlyKids!',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, #5c3d2e 0%, #3e2a1e 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                    
                    <tr>
                        <td style="padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #FFD700; font-size: 28px;">Welcome to GodlyKids! 🎉</h1>
                            <p style="margin: 15px 0 0; color: #eecaa0; font-size: 16px;">
                                Hi${name ? ` ${name}` : ''}! Your faith-filled adventure begins now!
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: rgba(255,255,255,0.95); border-radius: 15px; padding: 25px; text-align: center;">
                                <p style="margin: 0; color: #5c3d2e; font-size: 15px; line-height: 1.6;">
                                    Explore Bible stories, fun games, and activities that help kids grow in faith! 📚✨
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        };
        
        const info = await transport.sendMail(mailOptions);
        
        console.log('✅ Welcome email sent to:', email);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
    const transport = getTransporter();
    
    if (!transport) {
        return { success: false, error: 'Email not configured' };
    }
    
    try {
        await transport.verify();
        console.log('✅ Email configuration verified successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Email configuration error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send personalized parenting quiz results email
 */
const sendQuizResultsEmail = async (email, quizData) => {
    const transport = getTransporter();
    
    if (!transport) {
        console.log('📧 Quiz results email skipped (Gmail not configured)');
        return { success: false, error: 'Email service not configured' };
    }
    
    try {
        const fromEmail = process.env.EMAIL_USER || 'hello@kbpublish.org';
        
        // Generate personalized content based on quiz responses
        const personalizedContent = generatePersonalizedContent(quizData);
        
        const mailOptions = {
            from: `GodlyKids <${fromEmail}>`,
            to: email,
            subject: '💛 Your Heart-Centered Parenting Reflection',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #faf7f2; font-family: Georgia, 'Times New Roman', serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.06);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: normal; font-family: Georgia, serif;">GodlyKids</h1>
                            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-family: -apple-system, sans-serif;">Faith for Little Hearts 💛</p>
                        </td>
                    </tr>
                    
                    <!-- Profile Result -->
                    <tr>
                        <td style="padding: 40px 30px 30px;">
                            <p style="margin: 0 0 8px; color: #d97706; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, sans-serif; text-align: center;">Your Result</p>
                            <h2 style="margin: 0; color: #292524; font-size: 26px; text-align: center; line-height: 1.3;">
                                ${personalizedContent.title}
                            </h2>
                        </td>
                    </tr>
                    
                    <!-- Profile Description -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 25px; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0; color: #78350f; font-size: 16px; line-height: 1.7;">
                                    ${personalizedContent.description}
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Personalized Reflection -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <h3 style="margin: 0 0 15px; color: #292524; font-size: 18px;">💛 A Word for Your Journey</h3>
                            <p style="margin: 0 0 16px; color: #57534e; font-size: 15px; line-height: 1.8;">
                                ${personalizedContent.affirmation}
                            </p>
                            <p style="margin: 0 0 16px; color: #57534e; font-size: 15px; line-height: 1.8;">
                                ${personalizedContent.reflection}
                            </p>
                            <p style="margin: 0 0 16px; color: #57534e; font-size: 15px; line-height: 1.8;">
                                ${personalizedContent.hope}
                            </p>
                            <p style="margin: 0; color: #78716c; font-size: 14px; line-height: 1.7; font-style: italic;">
                                Many parents find that shared stories and gentle faith moments help these values grow naturally in their children's hearts.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Quiz Insights -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: #fafaf9; border-radius: 16px; padding: 25px;">
                                <h3 style="margin: 0 0 20px; color: #292524; font-size: 16px; font-family: -apple-system, sans-serif;">Based on Your Responses:</h3>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px; font-family: -apple-system, sans-serif;">Child's Age:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: 600; text-align: right; font-family: -apple-system, sans-serif;">${formatAge(quizData.childAge)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px; font-family: -apple-system, sans-serif;">Parenting Style:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: 600; text-align: right; font-family: -apple-system, sans-serif;">${formatStyle(quizData.authority)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px; font-family: -apple-system, sans-serif;">What Matters Most:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: 600; text-align: right; font-family: -apple-system, sans-serif;">${formatCharacter(quizData.character)}</td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- What Godly Kids Offers -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <h3 style="margin: 0 0 20px; color: #292524; font-size: 18px; text-align: center;">How Godly Kids Supports Heart-Centered Parenting</h3>
                            
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 10px; text-align: center; width: 50%;">
                                        <div style="font-size: 32px; margin-bottom: 8px;">📖</div>
                                        <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">Faith-Filled Stories</p>
                                        <p style="margin: 5px 0 0; color: #a8a29e; font-size: 12px; font-family: -apple-system, sans-serif;">That nurture the heart</p>
                                    </td>
                                    <td style="padding: 10px; text-align: center; width: 50%;">
                                        <div style="font-size: 32px; margin-bottom: 8px;">💛</div>
                                        <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">Gentle Lessons</p>
                                        <p style="margin: 5px 0 0; color: #a8a29e; font-size: 12px; font-family: -apple-system, sans-serif;">About God's love</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; text-align: center; width: 50%;">
                                        <div style="font-size: 32px; margin-bottom: 8px;">🎧</div>
                                        <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">Peaceful Audiobooks</p>
                                        <p style="margin: 5px 0 0; color: #a8a29e; font-size: 12px; font-family: -apple-system, sans-serif;">For quiet moments</p>
                                    </td>
                                    <td style="padding: 10px; text-align: center; width: 50%;">
                                        <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
                                        <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">Screen Time Trust</p>
                                        <p style="margin: 5px 0 0; color: #a8a29e; font-size: 12px; font-family: -apple-system, sans-serif;">No ads, no junk</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 0 30px 30px; text-align: center;">
                            <a href="https://app.godlykids.com" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 18px 50px; border-radius: 30px; font-weight: bold; font-size: 16px; box-shadow: 0 8px 20px rgba(245,158,11,0.35); font-family: -apple-system, sans-serif;">
                                Begin Your Child's Faith Journey →
                            </a>
                            <p style="margin: 15px 0 0; color: #a8a29e; font-size: 13px; font-family: -apple-system, sans-serif;">
                                Free to explore • Cancel anytime
                            </p>
                        </td>
                    </tr>
                    
                    <!-- App Download -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: #292524; border-radius: 16px; padding: 25px; text-align: center;">
                                <p style="margin: 0 0 15px; color: white; font-size: 16px; font-weight: 600; font-family: -apple-system, sans-serif;">📱 Download the App</p>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 5px; text-align: center;">
                                            <a href="https://apps.apple.com/us/app/godly-kids-kid-bible-stories/id6737245412" style="display: inline-block; background: white; color: #292524; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">
                                                🍎 App Store
                                            </a>
                                        </td>
                                        <td style="padding: 5px; text-align: center;">
                                            <a href="https://play.google.com/store/apps/details?id=com.godlykids.app" style="display: inline-block; background: white; color: #292524; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: -apple-system, sans-serif;">
                                                🤖 Google Play
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; text-align: center; border-top: 1px solid #e7e5e4;">
                            <p style="margin: 0 0 10px; color: #78716c; font-size: 13px; font-family: -apple-system, sans-serif;">
                                Questions? Reply to this email or visit<br>
                                <a href="https://godlykids.com" style="color: #f59e0b;">godlykids.com</a>
                            </p>
                            <p style="margin: 0; color: #d6d3d1; font-size: 11px; font-family: -apple-system, sans-serif;">
                                © ${new Date().getFullYear()} GodlyKids. Made with 💛 for Christian families.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `,
            text: `
Your Heart-Centered Parenting Reflection

${personalizedContent.title}

${personalizedContent.description}

A WORD FOR YOUR JOURNEY:

${personalizedContent.affirmation}

${personalizedContent.reflection}

${personalizedContent.hope}

Many parents find that shared stories and gentle faith moments help these values grow naturally in their children's hearts.

---

Based on Your Responses:
• Child's Age: ${formatAge(quizData.childAge)}
• Parenting Style: ${formatStyle(quizData.authority)}
• What Matters Most: ${formatCharacter(quizData.character)}

Start your child's faith journey: https://app.godlykids.com

Download the App:
- iOS: https://apps.apple.com/us/app/godly-kids-kid-bible-stories/id6737245412
- Android: https://play.google.com/store/apps/details?id=com.godlykids.app

© ${new Date().getFullYear()} GodlyKids
            `.trim()
        };
        
        const info = await transport.sendMail(mailOptions);
        
        console.log('✅ Quiz results email sent to:', email);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Quiz email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Format child age for display
 */
const formatAge = (age) => {
    const ageMap = {
        '3-4': '3-4 years',
        '5-6': '5-6 years',
        '7-9': '7-9 years',
        '10-12': '10-12 years'
    };
    return ageMap[age] || age || 'Not specified';
};

/**
 * Format parenting style for display
 */
const formatStyle = (style) => {
    const styleMap = {
        'gentle': 'Gentle & Guiding',
        'structured': 'Clear & Structured',
        'reactive': 'Responsive & Caring',
        'inconsistent': 'Flexible & Loving'
    };
    return styleMap[style] || style || 'Heart-centered';
};

/**
 * Format character focus for display
 */
const formatCharacter = (character) => {
    const charMap = {
        'heart': 'Shaping the heart',
        'responsibility': 'Teaching responsibility',
        'behavior': 'Building good habits',
        'conflict': 'Maintaining peace'
    };
    return charMap[character] || character || 'Growing together';
};

/**
 * Generate personalized content based on heart-centered parenting quiz
 */
const generatePersonalizedContent = (quizData) => {
    const { purpose, grace, rules, faith, identity, growth, character, deeper, authority, change, god, hope, heart } = quizData;
    
    // Calculate heart-centered score
    const heartCenteredCount = [
        purpose === 'honored',
        grace === 'understand',
        rules === 'guiding',
        faith === 'loves',
        identity === 'becoming',
        growth === 'gradual',
        character === 'heart',
        deeper === 'deeper',
        authority === 'gentle',
        change === 'relationship',
        god === 'pray',
        hope === 'very-hopeful',
        heart === 'peace'
    ].filter(Boolean).length;
    
    // Determine profile
    let title, description;
    if (heartCenteredCount >= 10) {
        title = "You're a Faithful, Heart-Aware Parent";
        description = "Your answers show a deep desire to guide your child with love, patience, and faith — even when it feels hard. You care about more than behavior. You care about the heart.";
    } else if (heartCenteredCount >= 7) {
        title = "You're a Growing, Intentional Parent";
        description = "Your responses reveal someone who genuinely wants to connect heart-to-heart with their child. You're building something beautiful — trust, grace, and faith woven into everyday moments.";
    } else if (heartCenteredCount >= 4) {
        title = "You're a Caring, Committed Parent";
        description = "Parenting is hard, and your answers show you're in the thick of it. You care deeply, even when it feels overwhelming. That care is the foundation for something wonderful.";
    } else {
        title = "You're a Seeking, Honest Parent";
        description = "Your willingness to reflect honestly is already a sign of strength. Every parent faces struggles — what matters is that you're here, seeking to grow alongside your child.";
    }
    
    // Generate personalized paragraphs
    const affirmation = "The fact that you took time to reflect on your parenting shows something beautiful about your heart. In a world that rushes past quiet moments, you chose to pause and consider what really matters.";
    
    let reflection;
    if (grace === 'understand' || grace === 'correct') {
        reflection = "Your instinct toward understanding when your child makes mistakes reflects God's own patience with us. Children learn best in an atmosphere of grace — where failure is a teacher, not a verdict.";
    } else {
        reflection = "It's natural to feel frustrated when things go wrong. What matters is that you keep showing up, keep trying, keep loving. Your child sees that persistence, even if they can't name it yet.";
    }
    
    let hopeMsg;
    if (hope === 'very-hopeful' || hope === 'mostly-hopeful') {
        hopeMsg = "Your hopefulness is a gift to your child. Hope isn't naive — it's the confident expectation that God is working even when we can't see it. Remember: you're not just raising a child. You're shaping a soul that will impact generations.";
    } else {
        hopeMsg = "If hope feels hard right now, that's okay. Seasons of uncertainty don't define your parenting — they refine it. The fact that you want more for your child proves something good is already growing. The small moments — the bedtime prayers, the patient corrections, the quiet cuddles — they all matter more than you know.";
    }
    
    return { title, description, affirmation, reflection, hope: hopeMsg };
};

module.exports = {
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendQuizResultsEmail,
    testEmailConfig
};
