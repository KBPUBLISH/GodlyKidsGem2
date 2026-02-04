const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const BackgroundMusic = require('../models/BackgroundMusic');
const { bucket } = require('../config/storage');

// GET /api/background-music
// List all background music tracks
router.get('/', async (req, res) => {
    try {
        const { goalTag, isActive, page = 1, limit = 50 } = req.query;
        
        const query = {};
        if (goalTag) query.goalTags = goalTag;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [tracks, total] = await Promise.all([
            BackgroundMusic.find(query)
                .sort({ isDefault: -1, name: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            BackgroundMusic.countDocuments(query)
        ]);
        
        res.json({
            tracks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching background music:', err);
        res.status(500).json({ error: 'Failed to fetch music' });
    }
});

// GET /api/background-music/for-goal/:goalTag
// Get music for a specific learning goal (for auto-selection)
router.get('/for-goal/:goalTag', async (req, res) => {
    try {
        const music = await BackgroundMusic.findForGoal(req.params.goalTag);
        
        if (!music) {
            return res.status(404).json({ error: 'No music found for this goal' });
        }
        
        res.json({ music });
    } catch (err) {
        console.error('Error finding music for goal:', err);
        res.status(500).json({ error: 'Failed to find music' });
    }
});

// GET /api/background-music/for-goals
// Get music for multiple goals (query param: goals=courage,faith)
router.get('/for-goals', async (req, res) => {
    try {
        const { goals } = req.query;
        const goalArray = goals ? goals.split(',') : [];
        
        const music = await BackgroundMusic.findForGoals(goalArray);
        
        if (!music) {
            return res.status(404).json({ error: 'No music found for these goals' });
        }
        
        res.json({ music });
    } catch (err) {
        console.error('Error finding music for goals:', err);
        res.status(500).json({ error: 'Failed to find music' });
    }
});

// GET /api/background-music/:id
// Get a single track
router.get('/:id', async (req, res) => {
    try {
        const track = await BackgroundMusic.findById(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json({ track });
    } catch (err) {
        console.error('Error fetching track:', err);
        res.status(500).json({ error: 'Failed to fetch track' });
    }
});

// POST /api/background-music
// Create a new track (with base64 audio upload)
router.post('/', async (req, res) => {
    try {
        const { name, description, audioBase64, filename, goalTags, moodTags, duration, isDefault } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        if (!audioBase64) {
            return res.status(400).json({ error: 'Audio file is required' });
        }
        
        // Upload audio to GCS
        const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        const ext = filename?.split('.').pop()?.toLowerCase() || 'mp3';
        const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
        
        const hash = crypto.createHash('md5').update(name + Date.now()).digest('hex').slice(0, 12);
        const gcsFilename = `devotional-stories/background-music/${hash}_${name.replace(/\s+/g, '_').toLowerCase()}.${ext}`;
        
        let audioUrl;
        
        if (bucket) {
            const blob = bucket.file(gcsFilename);
            await blob.save(buffer, {
                metadata: {
                    contentType,
                    cacheControl: 'public, max-age=31536000'
                }
            });
            await blob.makePublic();
            audioUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFilename}`;
        } else {
            return res.status(500).json({ error: 'Storage not configured' });
        }
        
        // If setting as default, unset other defaults for these goal tags
        if (isDefault && goalTags && goalTags.length > 0) {
            await BackgroundMusic.updateMany(
                { goalTags: { $in: goalTags }, isDefault: true },
                { isDefault: false }
            );
        }
        
        const track = new BackgroundMusic({
            name,
            description,
            audioUrl,
            goalTags: goalTags || [],
            moodTags: moodTags || [],
            duration,
            isDefault: isDefault || false,
        });
        
        await track.save();
        
        console.log(`🎵 Background music uploaded: ${name} -> ${audioUrl}`);
        
        res.status(201).json({ track });
    } catch (err) {
        console.error('Error creating track:', err);
        res.status(500).json({ error: 'Failed to create track' });
    }
});

// PUT /api/background-music/:id
// Update a track
router.put('/:id', async (req, res) => {
    try {
        const { name, description, goalTags, moodTags, duration, isDefault, isActive } = req.body;
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (goalTags !== undefined) updates.goalTags = goalTags;
        if (moodTags !== undefined) updates.moodTags = moodTags;
        if (duration !== undefined) updates.duration = duration;
        if (isDefault !== undefined) updates.isDefault = isDefault;
        if (isActive !== undefined) updates.isActive = isActive;
        
        // If setting as default, unset other defaults for these goal tags
        if (isDefault && goalTags && goalTags.length > 0) {
            await BackgroundMusic.updateMany(
                { _id: { $ne: req.params.id }, goalTags: { $in: goalTags }, isDefault: true },
                { isDefault: false }
            );
        }
        
        const track = await BackgroundMusic.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        
        res.json({ track });
    } catch (err) {
        console.error('Error updating track:', err);
        res.status(500).json({ error: 'Failed to update track' });
    }
});

// DELETE /api/background-music/:id
// Delete a track
router.delete('/:id', async (req, res) => {
    try {
        const track = await BackgroundMusic.findByIdAndDelete(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        
        // Optionally delete from GCS (commented out to preserve files)
        // if (bucket && track.audioUrl) {
        //     const filename = track.audioUrl.split('/').pop();
        //     await bucket.file(`devotional-stories/background-music/${filename}`).delete();
        // }
        
        res.json({ message: 'Track deleted' });
    } catch (err) {
        console.error('Error deleting track:', err);
        res.status(500).json({ error: 'Failed to delete track' });
    }
});

// POST /api/background-music/:id/set-default
// Set a track as default for its goal tags
router.post('/:id/set-default', async (req, res) => {
    try {
        const track = await BackgroundMusic.findById(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        
        // Unset other defaults for these goal tags
        if (track.goalTags.length > 0) {
            await BackgroundMusic.updateMany(
                { _id: { $ne: track._id }, goalTags: { $in: track.goalTags }, isDefault: true },
                { isDefault: false }
            );
        }
        
        track.isDefault = true;
        await track.save();
        
        res.json({ track });
    } catch (err) {
        console.error('Error setting default:', err);
        res.status(500).json({ error: 'Failed to set default' });
    }
});

module.exports = router;
