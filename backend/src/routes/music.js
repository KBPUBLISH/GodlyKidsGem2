const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Music = require('../models/Music');
const { bucket } = require('../config/storage');

/** Public: active tracks keyed by `target` (e.g. app-background) for client loops */
router.get('/active', async (req, res) => {
    try {
        const docs = await Music.find({ isActive: true }).lean();
        const out = {};
        for (const m of docs) {
            if (!m.target || !m.audioUrl) continue;
            out[m.target] = {
                audioUrl: m.audioUrl,
                defaultVolume: typeof m.defaultVolume === 'number' ? m.defaultVolume : 0.35,
                loop: m.loop !== false,
                name: m.name || m.target,
            };
        }
        res.json(out);
    } catch (error) {
        console.error('Error fetching active music:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/music — list configs (portal). Music model has no `status` field; do not filter on it.
router.get('/', async (req, res) => {
    try {
        const { category, target } = req.query;
        const query = {};
        if (category) query.category = category;
        if (target) query.target = target;

        const music = await Music.find(query).sort({ target: 1 }).lean();
        res.json(music);
    } catch (error) {
        console.error('Error fetching music:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/music/categories - Get music categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Music.distinct('category');
        res.json(categories);
    } catch (error) {
        console.error('Error fetching music categories:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/music/:id - Get a specific track
router.get('/:id', async (req, res) => {
    try {
        const track = await Music.findById(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json(track);
    } catch (error) {
        console.error('Error fetching track:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/music - Create or replace by target (admin / portal). Optional audioBase64 + filename uploads to GCS.
router.post('/', async (req, res) => {
    try {
        const body = { ...req.body };
        const { audioBase64, filename, originalFilename } = body;
        delete body.audioBase64;
        delete body.filename;

        let audioUrl = body.audioUrl;
        if (audioBase64) {
            if (!bucket) {
                return res.status(500).json({ error: 'Storage bucket not configured' });
            }
            const fname = filename || originalFilename || 'audio.mp3';
            const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = fname.split('.').pop()?.toLowerCase() || 'mp3';
            const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
            const safeTarget = String(body.target || 'misc').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
            const hash = crypto.createHash('md5').update(String(body.target) + fname + Date.now()).digest('hex').slice(0, 12);
            const gcsPath = `app-music/${safeTarget}/${hash}_${(body.name || 'track').replace(/\s+/g, '_').toLowerCase()}.${ext}`;
            const blob = bucket.file(gcsPath);
            await blob.save(buffer, {
                metadata: { contentType, cacheControl: 'public, max-age=31536000' },
            });
            await blob.makePublic();
            audioUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
        }

        if (!body.target || !body.name) {
            return res.status(400).json({ error: 'target and name are required' });
        }

        if (!audioUrl) {
            return res.status(400).json({ error: 'Provide audioUrl or upload an audio file (audioBase64 + filename)' });
        }
        body.audioUrl = audioUrl;
        body.originalFilename = body.originalFilename || filename || undefined;

        delete body._id;
        delete body.__v;
        delete body.createdAt;
        delete body.updatedAt;
        const track = await Music.findOneAndUpdate(
            { target: body.target },
            { $set: body },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        );

        res.status(201).json(track);
    } catch (error) {
        console.error('Error creating track:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/music/:id - Update a track (optional new file: audioBase64 + filename)
router.put('/:id', async (req, res) => {
    try {
        const body = { ...req.body };
        const { audioBase64, filename, originalFilename } = body;
        delete body.audioBase64;
        delete body.filename;
        delete body._id;
        delete body.target; // do not retarget via PUT (unique index)
        delete body.__v;

        if (audioBase64) {
            if (!bucket) {
                return res.status(500).json({ error: 'Storage bucket not configured' });
            }
            const existing = await Music.findById(req.params.id).lean();
            const fname = filename || originalFilename || 'audio.mp3';
            const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = fname.split('.').pop()?.toLowerCase() || 'mp3';
            const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
            const safeTarget = String(existing?.target || 'misc').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
            const hash = crypto.createHash('md5').update(req.params.id + fname + Date.now()).digest('hex').slice(0, 12);
            const gcsPath = `app-music/${safeTarget}/${hash}_${(body.name || existing?.name || 'track').replace(/\s+/g, '_').toLowerCase()}.${ext}`;
            const blob = bucket.file(gcsPath);
            await blob.save(buffer, {
                metadata: { contentType, cacheControl: 'public, max-age=31536000' },
            });
            await blob.makePublic();
            body.audioUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
            body.originalFilename = originalFilename || filename;
        }

        const track = await Music.findByIdAndUpdate(
            req.params.id,
            { $set: body },
            { new: true, runValidators: true },
        );
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json(track);
    } catch (error) {
        console.error('Error updating track:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/music/:id - Delete a track (admin)
router.delete('/:id', async (req, res) => {
    try {
        const track = await Music.findByIdAndDelete(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting track:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;


