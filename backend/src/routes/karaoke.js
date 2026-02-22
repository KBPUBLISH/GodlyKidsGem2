const express = require('express');
const router = express.Router();
const KaraokeSong = require('../models/KaraokeSong');
const KaraokeRecording = require('../models/KaraokeRecording');
const mongoose = require('mongoose');

// GET /api/karaoke - list karaoke songs (published by default, or all for portal)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status === 'all') {
            // portal: show all
        } else if (req.query.status) {
            filter.status = req.query.status;
        } else {
            filter.status = 'published';
        }

        const total = await KaraokeSong.countDocuments(filter);
        const songs = await KaraokeSong.find(filter)
            .sort({ order: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            data: songs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        });
    } catch (err) {
        console.error('Karaoke list error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/karaoke/:id - get one song
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const song = await KaraokeSong.findById(req.params.id).lean();
        if (!song) {
            return res.status(404).json({ message: 'Karaoke song not found' });
        }
        res.json(song);
    } catch (err) {
        console.error('Karaoke get error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/karaoke - create (portal)
router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            coverImage,
            videoUrl,
            backgroundAudioUrl,
            duration,
            lyrics,
            status,
            order,
            minAge,
            isMembersOnly,
            goalTags,
        } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const song = new KaraokeSong({
            title,
            description: description || '',
            coverImage: coverImage || null,
            videoUrl: videoUrl || null,
            backgroundAudioUrl: backgroundAudioUrl || null,
            duration: duration || 0,
            lyrics: Array.isArray(lyrics) ? lyrics : [],
            status: status || 'draft',
            order: order != null ? order : 0,
            minAge: minAge != null ? minAge : undefined,
            isMembersOnly: isMembersOnly || false,
            goalTags: Array.isArray(goalTags) ? goalTags : [],
        });
        await song.save();
        res.status(201).json(song);
    } catch (err) {
        console.error('Karaoke create error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/karaoke/:id - update (portal)
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const song = await KaraokeSong.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ message: 'Karaoke song not found' });
        }

        const allowed = [
            'title', 'description', 'coverImage', 'videoUrl', 'backgroundAudioUrl',
            'duration', 'lyrics', 'status', 'order', 'minAge', 'isMembersOnly', 'goalTags',
        ];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                song[key] = req.body[key];
            }
        }
        await song.save();
        res.json(song);
    } catch (err) {
        console.error('Karaoke update error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/karaoke/:id - delete (portal)
router.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const result = await KaraokeSong.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Karaoke song not found' });
        }
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('Karaoke delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/karaoke/:id/increment-view - bump view count (app)
router.post('/:id/increment-view', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        await KaraokeSong.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/karaoke/mix - mix background + recording, return mixed URL
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { bucket } = require('../config/storage');

let ffmpegAvailable = false;
try {
    if (ffmpegInstaller?.path) {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        ffmpegAvailable = true;
    }
} catch (e) {}

const mixMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

router.post('/mix', mixMulter.single('recording'), async (req, res) => {
    try {
        const { karaokeSongId } = req.body;
        if (!karaokeSongId || !req.file) {
            return res.status(400).json({ message: 'karaokeSongId and recording file are required' });
        }

        const song = await KaraokeSong.findById(karaokeSongId);
        if (!song || !song.backgroundAudioUrl) {
            return res.status(400).json({ message: 'Song not found or has no background audio' });
        }

        if (!ffmpegAvailable || !bucket) {
            return res.status(503).json({ message: 'Audio mixing is not available' });
        }

        const axios = require('axios');
        const resp = await axios.get(song.backgroundAudioUrl, { responseType: 'arraybuffer' });
        const bgBuffer = Buffer.from(resp.data);

        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'karaoke-'));
        const bgPath = path.join(tmpDir, 'background.mp3');
        const recPath = path.join(tmpDir, 'recording.webm');
        const outPath = path.join(tmpDir, 'mixed.mp3');

        try {
            await fs.promises.writeFile(bgPath, bgBuffer);
            await fs.promises.writeFile(recPath, req.file.buffer);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(bgPath)
                    .input(recPath)
                    .complexFilter('[0:a][1:a]amix=inputs=2:duration=first[aout]')
                    .outputOptions(['-map', '[aout]', '-ac', '2', '-b:a', '128k'])
                    .output(outPath)
                    .on('error', reject)
                    .on('end', resolve)
                    .run();
            });

            const mixedBuffer = await fs.promises.readFile(outPath);
            const gcsPath = `karaoke/${karaokeSongId}/recordings/${Date.now()}_mixed.mp3`;
            const blob = bucket.file(gcsPath);
            await blob.save(mixedBuffer, {
                metadata: { contentType: 'audio/mpeg' },
            });
            await blob.makePublic();
            const mixedUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;

            await KaraokeSong.findByIdAndUpdate(karaokeSongId, { $inc: { recordCount: 1 } });

            res.json({ mixedAudioUrl: mixedUrl, duration: song.duration });
        } finally {
            try {
                await fs.promises.unlink(bgPath).catch(() => {});
                await fs.promises.unlink(recPath).catch(() => {});
                await fs.promises.unlink(outPath).catch(() => {});
                await fs.promises.rmdir(tmpDir).catch(() => {});
            } catch (e) {}
        }
    } catch (err) {
        console.error('Karaoke mix error:', err);
        res.status(500).json({ message: err.message || 'Mix failed' });
    }
});

// POST /api/karaoke/recordings - save user recording (optional)
router.post('/recordings', async (req, res) => {
    try {
        const userId = req.user?.id || req.body.userId;
        const { karaokeSongId, mixedAudioUrl, duration } = req.body;

        if (!karaokeSongId || !mixedAudioUrl) {
            return res.status(400).json({ message: 'karaokeSongId and mixedAudioUrl are required' });
        }

        const rec = new KaraokeRecording({
            userId: userId || new mongoose.Types.ObjectId(),
            karaokeSongId,
            mixedAudioUrl,
            duration: duration || 0,
        });
        await rec.save();
        res.status(201).json(rec);
    } catch (err) {
        console.error('Karaoke recording save error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/karaoke/recordings - list user's saved recordings (optional)
router.get('/recordings/list', async (req, res) => {
    try {
        const userId = req.user?.id || req.query.userId;
        if (!userId) {
            return res.json({ data: [] });
        }
        const recordings = await KaraokeRecording.find({ userId })
            .populate('karaokeSongId', 'title coverImage')
            .sort({ recordedAt: -1 })
            .limit(50)
            .lean();
        res.json({ data: recordings });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
