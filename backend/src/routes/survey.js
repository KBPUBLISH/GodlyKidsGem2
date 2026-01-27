const express = require('express');
const router = express.Router();
const SurveyResponse = require('../models/Survey');

// POST /api/survey/submit - Submit a survey response
router.post('/submit', async (req, res) => {
    try {
        const {
            userId,
            email,
            surveyType = 'weekly_feedback',
            wantsMoreGames,
            wantsMoreBooks,
            wantsMoreAudioDramas,
            wantsMoreLessons,
            wantsMoreSongs,
            npsScore,
            customFeedback,
            metadata = {}
        } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'userId is required' 
            });
        }

        const surveyResponse = new SurveyResponse({
            userId,
            email,
            surveyType,
            wantsMoreGames: !!wantsMoreGames,
            wantsMoreBooks: !!wantsMoreBooks,
            wantsMoreAudioDramas: !!wantsMoreAudioDramas,
            wantsMoreLessons: !!wantsMoreLessons,
            wantsMoreSongs: !!wantsMoreSongs,
            npsScore,
            customFeedback,
            metadata
        });

        await surveyResponse.save();

        console.log(`📊 Survey submitted by ${email || userId}: NPS=${npsScore}`);
        
        res.json({
            success: true,
            message: 'Survey submitted successfully',
            id: surveyResponse._id
        });

    } catch (error) {
        console.error('❌ Survey submit error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to submit survey', 
            error: error.message 
        });
    }
});

// GET /api/survey/analytics - Get survey analytics for portal
router.get('/analytics', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get all responses in date range
        const responses = await SurveyResponse.find({
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });

        // Calculate statistics
        const totalResponses = responses.length;
        
        // Content preferences
        const contentPreferences = {
            games: responses.filter(r => r.wantsMoreGames).length,
            books: responses.filter(r => r.wantsMoreBooks).length,
            audioDramas: responses.filter(r => r.wantsMoreAudioDramas).length,
            lessons: responses.filter(r => r.wantsMoreLessons).length,
            songs: responses.filter(r => r.wantsMoreSongs).length,
        };

        // NPS calculations
        const npsResponses = responses.filter(r => r.npsScore !== null && r.npsScore !== undefined);
        const npsScores = npsResponses.map(r => r.npsScore);
        const avgNps = npsScores.length > 0 
            ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) 
            : 0;
        
        // NPS breakdown (Promoters: 9-10, Passives: 7-8, Detractors: 1-6)
        const promoters = npsResponses.filter(r => r.npsScore >= 9).length;
        const passives = npsResponses.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
        const detractors = npsResponses.filter(r => r.npsScore <= 6).length;
        
        // Calculate NPS score (-100 to 100)
        const npsPercentage = npsResponses.length > 0
            ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
            : 0;

        // NPS distribution (1-10)
        const npsDistribution = {};
        for (let i = 1; i <= 10; i++) {
            npsDistribution[i] = npsResponses.filter(r => r.npsScore === i).length;
        }

        // Recent feedback with custom responses
        const recentFeedback = responses
            .filter(r => r.customFeedback && r.customFeedback.trim())
            .slice(0, 50)
            .map(r => ({
                id: r._id,
                userId: r.userId,
                email: r.email,
                feedback: r.customFeedback,
                npsScore: r.npsScore,
                createdAt: r.createdAt,
                platform: r.metadata?.platform,
                subscriptionStatus: r.metadata?.subscriptionStatus,
            }));

        // Daily response counts for chart
        const dailyResponses = {};
        responses.forEach(r => {
            const dateKey = r.createdAt.toISOString().split('T')[0];
            dailyResponses[dateKey] = (dailyResponses[dateKey] || 0) + 1;
        });

        res.json({
            success: true,
            analytics: {
                totalResponses,
                dateRange: {
                    start: startDate,
                    end: new Date(),
                    days: parseInt(days)
                },
                contentPreferences,
                nps: {
                    averageScore: parseFloat(avgNps),
                    npsScore: npsPercentage,
                    totalResponses: npsResponses.length,
                    breakdown: {
                        promoters,
                        passives,
                        detractors
                    },
                    distribution: npsDistribution
                },
                recentFeedback,
                dailyResponses
            }
        });

    } catch (error) {
        console.error('❌ Survey analytics error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get survey analytics', 
            error: error.message 
        });
    }
});

// GET /api/survey/responses - Get paginated survey responses
router.get('/responses', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const responses = await SurveyResponse.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SurveyResponse.countDocuments();

        res.json({
            success: true,
            responses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Get survey responses error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get survey responses', 
            error: error.message 
        });
    }
});

module.exports = router;
