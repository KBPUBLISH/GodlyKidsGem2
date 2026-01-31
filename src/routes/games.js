const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const GamePlayEvent = require('../models/GamePlayEvent');

// GET all games
router.get('/', async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const games = await Game.find().sort({ gameId: 1 });
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET enabled games only
router.get('/enabled', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const games = await Game.find({ enabled: true }).sort({ gameId: 1 });
        res.json(games);
    } catch (error) {
        console.error('Error fetching enabled games:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET games for Daily Tasks & IQ Games section
router.get('/daily-tasks', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        // Get games that are enabled AND marked for daily tasks display
        const games = await Game.find({ 
            enabled: true, 
            showInDailyTasks: true 
        }).sort({ createdAt: -1 });
        
        res.json(games);
    } catch (error) {
        console.error('Error fetching daily task games:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET single game by ID
router.get('/:gameId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }
        res.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST create or update game
router.post('/', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const { gameId, name, enabled, description, settings, rewards, url, coverImage, gameType, showInDailyTasks, isPurchasable, goldCoinPrice, ageRating } = req.body;

        if (!gameId || !name) {
            return res.status(400).json({ message: 'gameId and name are required' });
        }

        // Check if game exists
        const existingGame = await Game.findOne({ gameId });
        
        if (existingGame) {
            // Update existing game
            existingGame.name = name;
            existingGame.enabled = enabled !== undefined ? enabled : existingGame.enabled;
            existingGame.description = description || existingGame.description;
            existingGame.url = url !== undefined ? url : existingGame.url;
            existingGame.coverImage = coverImage !== undefined ? coverImage : existingGame.coverImage;
            existingGame.gameType = gameType !== undefined ? gameType : existingGame.gameType;
            existingGame.showInDailyTasks = showInDailyTasks !== undefined ? showInDailyTasks : existingGame.showInDailyTasks;
            existingGame.isPurchasable = isPurchasable !== undefined ? isPurchasable : existingGame.isPurchasable;
            existingGame.goldCoinPrice = goldCoinPrice !== undefined ? goldCoinPrice : existingGame.goldCoinPrice;
            existingGame.ageRating = ageRating !== undefined ? ageRating : existingGame.ageRating;
            if (settings) existingGame.settings = { ...existingGame.settings, ...settings };
            if (rewards) existingGame.rewards = { ...existingGame.rewards, ...rewards };
            
            const updatedGame = await existingGame.save();
            res.json(updatedGame);
        } else {
            // Create new game
            const game = new Game({
                gameId,
                name,
                enabled: enabled !== undefined ? enabled : true,
                description,
                url,
                coverImage,
                gameType: gameType || 'modal',
                showInDailyTasks: showInDailyTasks !== undefined ? showInDailyTasks : true,
                isPurchasable: isPurchasable || false,
                goldCoinPrice: goldCoinPrice || 0,
                ageRating: ageRating || 'All Ages',
                settings: settings || {},
                rewards: rewards || {
                    threeStars: 50,
                    twoStars: 25,
                    oneStar: 10,
                },
            });
            
            const newGame = await game.save();
            res.status(201).json(newGame);
        }
    } catch (error) {
        console.error('Error saving game:', error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Game with this ID already exists',
                error: 'DUPLICATE_GAME_ID'
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// PUT update game
router.put('/:gameId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }

        // Update fields
        if (req.body.name !== undefined) game.name = req.body.name;
        if (req.body.enabled !== undefined) game.enabled = req.body.enabled;
        if (req.body.description !== undefined) game.description = req.body.description;
        if (req.body.url !== undefined) game.url = req.body.url;
        if (req.body.coverImage !== undefined) game.coverImage = req.body.coverImage;
        if (req.body.gameType !== undefined) game.gameType = req.body.gameType;
        if (req.body.showInDailyTasks !== undefined) game.showInDailyTasks = req.body.showInDailyTasks;
        if (req.body.isPurchasable !== undefined) game.isPurchasable = req.body.isPurchasable;
        if (req.body.goldCoinPrice !== undefined) game.goldCoinPrice = req.body.goldCoinPrice;
        if (req.body.ageRating !== undefined) game.ageRating = req.body.ageRating;
        if (req.body.settings) {
            game.settings = { ...game.settings, ...req.body.settings };
        }
        if (req.body.rewards) {
            game.rewards = { ...game.rewards, ...req.body.rewards };
        }

        const updatedGame = await game.save();
        res.json(updatedGame);
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(400).json({ message: error.message });
    }
});

// PUT toggle enabled/disabled
router.put('/:gameId/toggle', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }

        game.enabled = !game.enabled;
        const updatedGame = await game.save();
        res.json(updatedGame);
    } catch (error) {
        console.error('Error toggling game:', error);
        res.status(400).json({ message: error.message });
    }
});

// DELETE game
router.delete('/:gameId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                message: 'Database not connected. Please check MONGO_URI in .env file.',
                error: 'Database connection not established'
            });
        }

        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }

        await game.deleteOne();
        res.json({ message: 'Game deleted' });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================
// GAME PLAY EVENT TRACKING
// ============================================

// POST - Record a game play event
router.post('/play-event', async (req, res) => {
    try {
        const { 
            gameId, 
            gameName,
            userId, 
            kidName,
            sessionDurationSeconds,
            score,
            starsEarned,
            coinsEarned,
            completed,
            platform,
            metadata 
        } = req.body;
        
        if (!gameId || !userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'gameId and userId are required' 
            });
        }
        
        // Create the play event
        const playEvent = new GamePlayEvent({
            gameId,
            gameName: gameName || gameId,
            userId,
            kidName,
            sessionDurationSeconds: sessionDurationSeconds || 0,
            score: score || 0,
            starsEarned: starsEarned || 0,
            coinsEarned: coinsEarned || 0,
            completed: completed || false,
            platform: platform || 'unknown',
            metadata: metadata || {},
            playedAt: new Date(),
        });
        
        await playEvent.save();
        
        console.log(`🎮 Game play recorded: ${gameId} by ${userId} - ${sessionDurationSeconds}s, ${starsEarned}⭐, ${coinsEarned}🪙`);
        
        res.status(201).json({ 
            success: true, 
            eventId: playEvent._id,
            message: 'Game play event recorded'
        });
    } catch (error) {
        console.error('Error recording game play event:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Get game analytics (summary stats for all games)
router.get('/analytics/summary', async (req, res) => {
    try {
        const { timeRange = 'all' } = req.query;
        
        // Calculate time range start date
        const now = new Date();
        let startDate = null;
        
        switch (timeRange) {
            case 'day':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
            default:
                startDate = null;
                break;
        }
        
        // Build match stage
        const matchStage = startDate ? { playedAt: { $gte: startDate } } : {};
        
        // Aggregate game play stats
        const gameStats = await GamePlayEvent.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$gameId',
                    gameName: { $first: '$gameName' },
                    totalPlays: { $sum: 1 },
                    uniquePlayers: { $addToSet: '$userId' },
                    totalSessionSeconds: { $sum: '$sessionDurationSeconds' },
                    avgSessionSeconds: { $avg: '$sessionDurationSeconds' },
                    totalScore: { $sum: '$score' },
                    avgScore: { $avg: '$score' },
                    totalStars: { $sum: '$starsEarned' },
                    avgStars: { $avg: '$starsEarned' },
                    totalCoinsEarned: { $sum: '$coinsEarned' },
                    completedCount: { $sum: { $cond: ['$completed', 1, 0] } },
                    lastPlayed: { $max: '$playedAt' },
                }
            },
            {
                $project: {
                    _id: 1,
                    gameName: 1,
                    totalPlays: 1,
                    uniquePlayerCount: { $size: '$uniquePlayers' },
                    totalSessionSeconds: 1,
                    avgSessionSeconds: { $round: ['$avgSessionSeconds', 0] },
                    totalScore: 1,
                    avgScore: { $round: ['$avgScore', 0] },
                    totalStars: 1,
                    avgStars: { $round: ['$avgStars', 1] },
                    totalCoinsEarned: 1,
                    completedCount: 1,
                    completionRate: { 
                        $round: [
                            { $multiply: [{ $divide: ['$completedCount', '$totalPlays'] }, 100] },
                            0
                        ]
                    },
                    lastPlayed: 1,
                }
            },
            { $sort: { totalPlays: -1 } }
        ]);
        
        // Get overall summary
        const overallStats = await GamePlayEvent.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalPlays: { $sum: 1 },
                    uniquePlayers: { $addToSet: '$userId' },
                    totalSessionSeconds: { $sum: '$sessionDurationSeconds' },
                    avgSessionSeconds: { $avg: '$sessionDurationSeconds' },
                    totalCoinsEarned: { $sum: '$coinsEarned' },
                    completedCount: { $sum: { $cond: ['$completed', 1, 0] } },
                }
            }
        ]);
        
        const summary = overallStats[0] || {
            totalPlays: 0,
            uniquePlayers: [],
            totalSessionSeconds: 0,
            avgSessionSeconds: 0,
            totalCoinsEarned: 0,
            completedCount: 0,
        };
        
        // Get daily play counts for chart
        const dailyPlays = await GamePlayEvent.aggregate([
            { 
                $match: { 
                    playedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } 
                } 
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$playedAt' } },
                    count: { $sum: 1 },
                    uniquePlayers: { $addToSet: '$userId' },
                }
            },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    uniquePlayerCount: { $size: '$uniquePlayers' },
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            success: true,
            timeRange,
            summary: {
                totalPlays: summary.totalPlays,
                uniquePlayerCount: summary.uniquePlayers?.length || 0,
                totalSessionMinutes: Math.round(summary.totalSessionSeconds / 60),
                avgSessionSeconds: Math.round(summary.avgSessionSeconds || 0),
                totalCoinsEarned: summary.totalCoinsEarned,
                completionRate: summary.totalPlays > 0 
                    ? Math.round((summary.completedCount / summary.totalPlays) * 100) 
                    : 0,
            },
            games: gameStats,
            dailyPlays: dailyPlays.map(d => ({
                date: d._id,
                plays: d.count,
                uniquePlayers: d.uniquePlayerCount,
            })),
        });
    } catch (error) {
        console.error('Error fetching game analytics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Get recent game play events (for dashboard)
router.get('/analytics/recent', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const recentPlays = await GamePlayEvent.find({})
            .sort({ playedAt: -1 })
            .limit(parseInt(limit))
            .lean();
        
        res.json({
            success: true,
            events: recentPlays.map(e => ({
                id: e._id,
                gameId: e.gameId,
                gameName: e.gameName,
                userId: e.userId,
                kidName: e.kidName,
                sessionDurationSeconds: e.sessionDurationSeconds,
                score: e.score,
                starsEarned: e.starsEarned,
                coinsEarned: e.coinsEarned,
                completed: e.completed,
                platform: e.platform,
                playedAt: e.playedAt,
            })),
        });
    } catch (error) {
        console.error('Error fetching recent game plays:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Get play history for a specific user
router.get('/analytics/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100 } = req.query;
        
        const userPlays = await GamePlayEvent.find({ userId })
            .sort({ playedAt: -1 })
            .limit(parseInt(limit))
            .lean();
        
        // Aggregate stats for this user
        const userStats = await GamePlayEvent.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: '$gameId',
                    gameName: { $first: '$gameName' },
                    playCount: { $sum: 1 },
                    totalSessionSeconds: { $sum: '$sessionDurationSeconds' },
                    totalScore: { $sum: '$score' },
                    totalStars: { $sum: '$starsEarned' },
                    totalCoins: { $sum: '$coinsEarned' },
                    bestScore: { $max: '$score' },
                    lastPlayed: { $max: '$playedAt' },
                }
            },
            { $sort: { playCount: -1 } }
        ]);
        
        res.json({
            success: true,
            userId,
            gameStats: userStats,
            recentPlays: userPlays.map(e => ({
                id: e._id,
                gameId: e.gameId,
                gameName: e.gameName,
                kidName: e.kidName,
                sessionDurationSeconds: e.sessionDurationSeconds,
                score: e.score,
                starsEarned: e.starsEarned,
                coinsEarned: e.coinsEarned,
                completed: e.completed,
                playedAt: e.playedAt,
            })),
        });
    } catch (error) {
        console.error('Error fetching user game history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
