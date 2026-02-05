const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const StoryBackground = require('../models/StoryBackground');
const { bucket } = require('../config/storage');

// Category definitions for frontend display
const CATEGORIES = [
    { id: 'nature', name: 'Nature', emoji: '🌿', description: 'Forests, beaches, mountains, gardens' },
    { id: 'home', name: 'Home', emoji: '🏠', description: 'Bedrooms, living rooms, kitchens' },
    { id: 'adventure', name: 'Adventure', emoji: '🗺️', description: 'Castles, ships, caves, journeys' },
    { id: 'biblical', name: 'Biblical', emoji: '⛪', description: 'Temples, ancient cities, deserts' },
    { id: 'fantasy', name: 'Fantasy', emoji: '✨', description: 'Magical worlds, clouds, stars' },
    { id: 'school', name: 'School', emoji: '📚', description: 'Classrooms, playgrounds, libraries' },
    { id: 'outdoor', name: 'Outdoor', emoji: '🌳', description: 'Parks, farms, camping' },
    { id: 'other', name: 'Other', emoji: '🎨', description: 'Miscellaneous backgrounds' },
];

const MOOD_OPTIONS = [
    { id: 'happy', name: 'Happy', emoji: '😊' },
    { id: 'calm', name: 'Calm', emoji: '😌' },
    { id: 'adventurous', name: 'Adventurous', emoji: '🚀' },
    { id: 'mysterious', name: 'Mysterious', emoji: '🔮' },
    { id: 'peaceful', name: 'Peaceful', emoji: '🕊️' },
    { id: 'exciting', name: 'Exciting', emoji: '⚡' },
    { id: 'cozy', name: 'Cozy', emoji: '🏡' },
    { id: 'dramatic', name: 'Dramatic', emoji: '🎭' },
];

// GET /api/story-backgrounds/options
// Get available categories and mood options
router.get('/options', (req, res) => {
    res.json({
        categories: CATEGORIES,
        moods: MOOD_OPTIONS,
    });
});

// GET /api/story-backgrounds
// List backgrounds with filtering
router.get('/', async (req, res) => {
    try {
        const { 
            category, 
            tags, 
            moodTags, 
            goalTags, 
            orientation, 
            status = 'active',
            page = 1, 
            limit = 50 
        } = req.query;
        
        const query = {};
        
        if (status) query.status = status;
        if (category) query.category = category;
        if (orientation) query.orientation = orientation;
        if (tags) query.tags = { $in: tags.split(',') };
        if (moodTags) query.moodTags = { $in: moodTags.split(',') };
        if (goalTags) query.goalTags = { $in: goalTags.split(',') };
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [backgrounds, total] = await Promise.all([
            StoryBackground.find(query)
                .sort({ order: 1, useCount: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            StoryBackground.countDocuments(query)
        ]);
        
        res.json({
            backgrounds,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching backgrounds:', err);
        res.status(500).json({ error: 'Failed to fetch backgrounds' });
    }
});

// GET /api/story-backgrounds/search
// Search backgrounds by criteria
router.get('/search', async (req, res) => {
    try {
        const { category, tags, moodTags, goalTags, orientation, limit = 20 } = req.query;
        
        const backgrounds = await StoryBackground.findMatching({
            category,
            tags: tags ? tags.split(',') : undefined,
            moodTags: moodTags ? moodTags.split(',') : undefined,
            goalTags: goalTags ? goalTags.split(',') : undefined,
            orientation,
            limit: parseInt(limit)
        });
        
        res.json({ backgrounds });
    } catch (err) {
        console.error('Error searching backgrounds:', err);
        res.status(500).json({ error: 'Failed to search backgrounds' });
    }
});

// GET /api/story-backgrounds/:id
// Get single background
router.get('/:id', async (req, res) => {
    try {
        const background = await StoryBackground.findById(req.params.id);
        if (!background) {
            return res.status(404).json({ error: 'Background not found' });
        }
        res.json({ background });
    } catch (err) {
        console.error('Error fetching background:', err);
        res.status(500).json({ error: 'Failed to fetch background' });
    }
});

// POST /api/story-backgrounds
// Upload new background image
router.post('/', async (req, res) => {
    try {
        const { 
            imageBase64, 
            name, 
            category, 
            tags, 
            moodTags, 
            goalTags, 
            description,
            orientation,
            suggestedCharacterPosition 
        } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: 'Image is required' });
        }
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate unique filename
        const hash = crypto.createHash('md5').update(base64Data.slice(0, 1000) + Date.now()).digest('hex').slice(0, 12);
        const filename = `story-backgrounds/${category || 'other'}/${hash}.png`;
        
        let imageUrl;
        
        if (bucket) {
            // Upload to GCS
            const blob = bucket.file(filename);
            await blob.save(buffer, {
                metadata: {
                    contentType: 'image/png',
                    cacheControl: 'public, max-age=31536000'
                }
            });
            await blob.makePublic();
            
            imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            console.log(`📸 Background uploaded: ${imageUrl}`);
        } else {
            return res.status(500).json({ error: 'Storage not configured' });
        }
        
        // Create background record
        const background = new StoryBackground({
            name,
            imageUrl,
            category: category || 'other',
            tags: tags || [],
            moodTags: moodTags || [],
            goalTags: goalTags || [],
            description,
            orientation: orientation || 'portrait',
            suggestedCharacterPosition: suggestedCharacterPosition || { x: 50, y: 70, scale: 1 },
        });
        
        await background.save();
        
        res.status(201).json({ background });
    } catch (err) {
        console.error('Error creating background:', err);
        res.status(500).json({ error: 'Failed to create background' });
    }
});

// PUT /api/story-backgrounds/:id
// Update background metadata
router.put('/:id', async (req, res) => {
    try {
        const { 
            name, 
            category, 
            tags, 
            moodTags, 
            goalTags, 
            description,
            orientation,
            suggestedCharacterPosition,
            isPremium,
            status,
            order
        } = req.body;
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (tags !== undefined) updates.tags = tags;
        if (moodTags !== undefined) updates.moodTags = moodTags;
        if (goalTags !== undefined) updates.goalTags = goalTags;
        if (description !== undefined) updates.description = description;
        if (orientation !== undefined) updates.orientation = orientation;
        if (suggestedCharacterPosition !== undefined) updates.suggestedCharacterPosition = suggestedCharacterPosition;
        if (isPremium !== undefined) updates.isPremium = isPremium;
        if (status !== undefined) updates.status = status;
        if (order !== undefined) updates.order = order;
        
        const background = await StoryBackground.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!background) {
            return res.status(404).json({ error: 'Background not found' });
        }
        
        res.json({ background });
    } catch (err) {
        console.error('Error updating background:', err);
        res.status(500).json({ error: 'Failed to update background' });
    }
});

// DELETE /api/story-backgrounds/:id
// Delete background
router.delete('/:id', async (req, res) => {
    try {
        const background = await StoryBackground.findById(req.params.id);
        if (!background) {
            return res.status(404).json({ error: 'Background not found' });
        }
        
        // Optionally delete from GCS
        if (bucket && background.imageUrl) {
            try {
                const filename = background.imageUrl.split(`${bucket.name}/`)[1];
                if (filename) {
                    await bucket.file(filename).delete();
                    console.log(`🗑️ Deleted file: ${filename}`);
                }
            } catch (deleteErr) {
                console.warn('Could not delete file from GCS:', deleteErr.message);
            }
        }
        
        await StoryBackground.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Background deleted' });
    } catch (err) {
        console.error('Error deleting background:', err);
        res.status(500).json({ error: 'Failed to delete background' });
    }
});

// POST /api/story-backgrounds/:id/use
// Record that a background was used (for popularity tracking)
router.post('/:id/use', async (req, res) => {
    try {
        await StoryBackground.recordUse(req.params.id);
        res.json({ message: 'Use recorded' });
    } catch (err) {
        console.error('Error recording use:', err);
        res.status(500).json({ error: 'Failed to record use' });
    }
});

// PUT /api/story-backgrounds/reorder
// Reorder backgrounds
router.put('/reorder', async (req, res) => {
    try {
        const { orderedIds } = req.body;
        
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds array required' });
        }
        
        const updates = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { order: index }
            }
        }));
        
        await StoryBackground.bulkWrite(updates);
        
        res.json({ message: 'Order updated' });
    } catch (err) {
        console.error('Error reordering backgrounds:', err);
        res.status(500).json({ error: 'Failed to reorder' });
    }
});

module.exports = router;
