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
 * Send personalized quiz results email with AI-generated content
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
            subject: '✨ Your Child\'s Personalized Faith Journey Plan',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #faf7f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                    
                    <!-- Header with warm gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">GodlyKids</h1>
                            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Faith for Little Hearts 💛</p>
                        </td>
                    </tr>
                    
                    <!-- Welcome Message -->
                    <tr>
                        <td style="padding: 40px 30px 20px;">
                            <h2 style="margin: 0; color: #292524; font-size: 24px; text-align: center;">
                                Your Child's Faith Journey Awaits! ✨
                            </h2>
                            <p style="margin: 15px 0 0; color: #57534e; font-size: 16px; line-height: 1.6; text-align: center;">
                                Thank you for taking our parent quiz. We've created a personalized plan based on your responses.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Personalized Insights Card -->
                    <tr>
                        <td style="padding: 0 30px 20px;">
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 25px; border: 2px solid #f59e0b;">
                                <h3 style="margin: 0 0 15px; color: #92400e; font-size: 18px;">📋 Based on Your Quiz</h3>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Child's Age Group:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: bold; text-align: right;">${quizData.childAge || 'Not specified'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Learning Style:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: bold; text-align: right;">${quizData.learningStyle || 'Mixed'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Faith Approach:</td>
                                        <td style="padding: 8px 0; color: #292524; font-size: 14px; font-weight: bold; text-align: right;">${quizData.faithApproach || 'Joyful'}</td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Values Section -->
                    ${quizData.values && quizData.values.length > 0 ? `
                    <tr>
                        <td style="padding: 0 30px 20px;">
                            <h3 style="margin: 0 0 15px; color: #292524; font-size: 18px;">💝 Values You Want to Nurture</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${quizData.values.map(value => `
                                    <span style="display: inline-block; background: #f5f5f4; color: #57534e; padding: 8px 16px; border-radius: 20px; font-size: 13px; margin: 4px;">${value}</span>
                                `).join('')}
                            </div>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Personalized Recommendations -->
                    <tr>
                        <td style="padding: 0 30px 20px;">
                            <h3 style="margin: 0 0 15px; color: #292524; font-size: 18px;">🌟 ${personalizedContent.title}</h3>
                            <p style="margin: 0; color: #57534e; font-size: 15px; line-height: 1.7;">
                                ${personalizedContent.message}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Feature Highlights -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: #fafaf9; border-radius: 16px; padding: 25px;">
                                <h3 style="margin: 0 0 20px; color: #292524; font-size: 18px; text-align: center;">What Your Child Will Love 💛</h3>
                                
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 10px; text-align: center; width: 33%;">
                                            <div style="font-size: 32px; margin-bottom: 8px;">📖</div>
                                            <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600;">Bible Stories</p>
                                            <p style="margin: 5px 0 0; color: #a8a29e; font-size: 11px;">Animated & engaging</p>
                                        </td>
                                        <td style="padding: 10px; text-align: center; width: 33%;">
                                            <div style="font-size: 32px; margin-bottom: 8px;">🎵</div>
                                            <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600;">Worship Songs</p>
                                            <p style="margin: 5px 0 0; color: #a8a29e; font-size: 11px;">Kid-friendly music</p>
                                        </td>
                                        <td style="padding: 10px; text-align: center; width: 33%;">
                                            <div style="font-size: 32px; margin-bottom: 8px;">🎮</div>
                                            <p style="margin: 0; color: #57534e; font-size: 13px; font-weight: 600;">Faith Games</p>
                                            <p style="margin: 5px 0 0; color: #a8a29e; font-size: 11px;">Learning through play</p>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 0 30px 30px; text-align: center;">
                            <a href="https://app.godlykids.com" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 18px 50px; border-radius: 30px; font-weight: bold; font-size: 16px; box-shadow: 0 8px 20px rgba(245,158,11,0.35);">
                                Start Your Child's Journey →
                            </a>
                            <p style="margin: 15px 0 0; color: #a8a29e; font-size: 13px;">
                                Free to explore • Cancel anytime
                            </p>
                        </td>
                    </tr>
                    
                    <!-- App Download -->
                    <tr>
                        <td style="padding: 0 30px 30px;">
                            <div style="background: #292524; border-radius: 16px; padding: 25px; text-align: center;">
                                <p style="margin: 0 0 15px; color: white; font-size: 16px; font-weight: 600;">📱 Download the App</p>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 5px; text-align: center;">
                                            <a href="https://apps.apple.com/us/app/godly-kids-kid-bible-stories/id6737245412" style="display: inline-block; background: white; color: #292524; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                                                🍎 App Store
                                            </a>
                                        </td>
                                        <td style="padding: 5px; text-align: center;">
                                            <a href="https://play.google.com/store/apps/details?id=com.godlykids.app" style="display: inline-block; background: white; color: #292524; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 600;">
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
                            <p style="margin: 0 0 10px; color: #78716c; font-size: 13px;">
                                Questions? Reply to this email or visit<br>
                                <a href="https://godlykids.com" style="color: #f59e0b;">godlykids.com</a>
                            </p>
                            <p style="margin: 0; color: #d6d3d1; font-size: 11px;">
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
Your Child's Personalized Faith Journey Plan

Thank you for taking our parent quiz! Here's your personalized plan:

Child's Age: ${quizData.childAge || 'Not specified'}
Learning Style: ${quizData.learningStyle || 'Mixed'}
Faith Approach: ${quizData.faithApproach || 'Joyful'}

Values you want to nurture:
${quizData.values ? quizData.values.join(', ') : 'Growing in faith'}

${personalizedContent.title}
${personalizedContent.message}

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
 * Generate personalized content based on quiz responses
 */
const generatePersonalizedContent = (quizData) => {
    const { childAge, learningStyle, faithApproach, values = [], screenTimeFeeling } = quizData;
    
    // Age-specific recommendations
    let ageContent = '';
    if (childAge === '3–4') {
        ageContent = 'For your little one, we recommend starting with our animated Bible stories featuring colorful characters and simple messages about God\'s love.';
    } else if (childAge === '5–6') {
        ageContent = 'At this age, your child is ready to explore interactive Bible stories with gentle lessons about kindness, sharing, and faith.';
    } else if (childAge === '7–9') {
        ageContent = 'Your child can dive deeper into Scripture with our chapter-based stories, character studies, and faith-building activities.';
    } else if (childAge === '10–12') {
        ageContent = 'Pre-teens can engage with more complex Biblical narratives, devotionals, and discussions about applying faith to daily life.';
    } else {
        ageContent = 'We have age-appropriate content for every stage of your child\'s faith journey.';
    }
    
    // Learning style recommendations
    let styleContent = '';
    if (learningStyle === 'Through stories') {
        styleContent = 'Since your child loves stories, they\'ll enjoy our extensive library of animated Bible stories with engaging narratives.';
    } else if (learningStyle === 'Through listening') {
        styleContent = 'For your auditory learner, our audiobooks and worship songs will help faith take root through hearing God\'s Word.';
    } else if (learningStyle === 'Through pictures and visuals') {
        styleContent = 'Visual learners will love our beautifully illustrated stories and interactive coloring activities.';
    } else {
        styleContent = 'With our mix of stories, music, and activities, there\'s something for every learning moment.';
    }
    
    // Combine into personalized message
    const title = 'Your Personalized Recommendations';
    const message = `${ageContent} ${styleContent} With your focus on ${values.length > 0 ? values.slice(0, 2).join(' and ').toLowerCase() : 'growing in faith'}, we\'ve curated content that aligns with your family\'s values. Every story, song, and activity is designed to nurture your child\'s heart and help them experience God\'s love in a ${faithApproach ? faithApproach.toLowerCase() : 'joyful'} way.`;
    
    return { title, message };
};

module.exports = {
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendQuizResultsEmail,
    testEmailConfig
};
