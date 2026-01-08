const express = require('express');
const router = express.Router();
const { sendQuizResultsEmail } = require('../services/emailService');

/**
 * POST /api/parent-quiz/submit
 * Submit quiz results and send personalized email
 */
router.post('/submit', async (req, res) => {
    try {
        const { email, quizData } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid email is required' 
            });
        }
        
        console.log('📋 Parent Quiz submission received:', {
            email: email.substring(0, 3) + '***',
            childAge: quizData?.childAge,
            values: quizData?.values?.length || 0,
            learningStyle: quizData?.learningStyle
        });
        
        // Send personalized email
        const emailResult = await sendQuizResultsEmail(email, quizData || {});
        
        if (emailResult.success) {
            console.log('✅ Quiz results email sent successfully');
            res.json({ 
                success: true, 
                message: 'Your personalized plan has been sent to your email!' 
            });
        } else {
            console.warn('⚠️ Email sending failed:', emailResult.error);
            // Still return success to user - we don't want to block them
            res.json({ 
                success: true, 
                message: 'Thank you! Continue to the app to start your journey.',
                emailSent: false
            });
        }
        
    } catch (error) {
        console.error('❌ Parent quiz submission error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process quiz submission' 
        });
    }
});

/**
 * GET /api/parent-quiz/test
 * Test endpoint
 */
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Parent Quiz API is working' });
});

module.exports = router;

