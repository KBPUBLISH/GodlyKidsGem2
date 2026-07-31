const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MusicVideo = require('../models/MusicVideo');

const NEW_WINDOW_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks

// Attach computed "isNew" / "isPopular" badge flags to a list of videos.
const withBadges = (videos) => {
    const now = Date.now();
    const withViews = videos
        .filter(v => (v.viewCount || 0) > 0)
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    const popularCount = Math.max(1, Math.ceil(withViews.length * 0.4));
    const popularIds = new Set(withViews.slice(0, popularCount).map(v => String(v._id)));

    return videos.map(v => ({
        ...v,
        isNew: v.createdAt ? (now - new Date(v.createdAt).getTime()) < NEW_WINDOW_MS : false,
        isPopular: popularIds.has(String(v._id)),
    }));
};

// GET /api/music-videos - list (published by default, or all for the portal)
// Returns a plain array sorted for display: featured first, then order, then newest.
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.status === 'all') {
            // portal: show everything
        } else if (req.query.status) {
            filter.status = req.query.status;
        } else {
            filter.status = 'published';
        }

        const videos = await MusicVideo.find(filter)
            .sort({ isFeatured: -1, featuredOrder: 1, order: 1, createdAt: -1 })
            .lean();

        res.json(withBadges(videos));
    } catch (err) {
        console.error('Music videos list error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/music-videos/:id
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const video = await MusicVideo.findById(req.params.id).lean();
        if (!video) return res.status(404).json({ message: 'Music video not found' });
        res.json(video);
    } catch (err) {
        console.error('Music video get error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/music-videos - create (portal)
router.post('/', async (req, res) => {
    try {
        const {
            title, author, description, thumbnailUrl, videoUrl, duration,
            status, isFeatured, featuredOrder, order, isMembersOnly, minAge,
        } = req.body;

        if (!title) return res.status(400).json({ message: 'Title is required' });

        const video = new MusicVideo({
            title,
            author: author || 'Kingdom Builders Publishing',
            description: description || '',
            thumbnailUrl: thumbnailUrl || null,
            videoUrl: videoUrl || null,
            duration: duration || 0,
            status: status || 'draft',
            isFeatured: isFeatured === true,
            featuredOrder: featuredOrder != null ? featuredOrder : 0,
            order: order != null ? order : 0,
            isMembersOnly: isMembersOnly !== false, // default members-only
            minAge: minAge != null ? minAge : undefined,
        });
        await video.save();
        res.status(201).json(video);
    } catch (err) {
        console.error('Music video create error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/music-videos/:id - update (portal)
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const video = await MusicVideo.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Music video not found' });

        const allowed = [
            'title', 'author', 'description', 'thumbnailUrl', 'videoUrl', 'duration',
            'status', 'isFeatured', 'featuredOrder', 'order', 'isMembersOnly', 'minAge',
        ];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                video[key] = req.body[key];
            }
        }
        await video.save();
        res.json(video);
    } catch (err) {
        console.error('Music video update error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/music-videos/:id - delete (portal)
router.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const result = await MusicVideo.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Music video not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('Music video delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/music-videos/:id/increment-view - bump view count (app)
router.post('/:id/increment-view', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        await MusicVideo.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
