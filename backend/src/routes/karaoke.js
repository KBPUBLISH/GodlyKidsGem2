const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const KaraokeSong = require('../models/KaraokeSong');
const KaraokeRecording = require('../models/KaraokeRecording');
const AppUser = require('../models/AppUser');
const mongoose = require('mongoose');
const { bucket } = require('../config/storage');
const { GoogleGenAI } = require('@google/genai');

/** Resolve userId (ObjectId, email, or deviceId) to ObjectId for recordings. */
async function resolveUserId(userId) {
    if (!userId) return null;
    if (mongoose.Types.ObjectId.isValid(userId) && String(userId).length === 24) {
        return new mongoose.Types.ObjectId(userId);
    }
    const user = await AppUser.findOne({
        $or: [{ email: userId }, { deviceId: userId }],
    }).select('_id').lean();
    return user ? user._id : null;
}

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

// GET /api/karaoke/share/:recordingId - get recording for share link (public, no auth)
router.get('/share/:recordingId', async (req, res) => {
    try {
        const { recordingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(recordingId)) {
            return res.status(400).json({ message: 'Invalid recording ID' });
        }
        const rec = await KaraokeRecording.findById(recordingId)
            .populate('karaokeSongId', 'title coverImage')
            .lean();
        if (!rec || !rec.mixedAudioUrl) {
            return res.status(404).json({ message: 'Recording not found' });
        }
        res.json({
            mixedAudioUrl: rec.mixedAudioUrl,
            duration: rec.duration || 0,
            recordedAt: rec.recordedAt,
            customCoverImageUrl: rec.customCoverImageUrl || null,
            artistName: rec.artistName || null,
            song: rec.karaokeSongId ? {
                title: rec.karaokeSongId.title,
                coverImage: rec.customCoverImageUrl || rec.karaokeSongId.coverImage,
            } : null,
        });
    } catch (err) {
        console.error('Karaoke share get error:', err);
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
            coverImagePrompts,
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
            coverImagePrompts: Array.isArray(coverImagePrompts) ? coverImagePrompts : [],
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
            'duration', 'lyrics', 'status', 'order', 'minAge', 'isMembersOnly', 'goalTags', 'coverImagePrompts',
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

const COVER_STYLES = {
    pixar: 'Pixar-style 3D animation: soft rounded shapes, expressive faces, warm studio lighting, high-quality CGI.',
    illustration: 'Colorful 2D illustration: hand-drawn feel, vibrant colors, gentle lines, child-friendly art style.',
    disney: 'Disney-style animation: classic animated look, expressive characters, magical atmosphere, warm colors.',
};

// POST /api/karaoke/album-cover - generate personalized album cover from selfie using Gemini 2.5
router.post('/album-cover', async (req, res) => {
    try {
        const { selfieBase64, songTitle, coverPrompts, style } = req.body;
        if (!selfieBase64 || !songTitle) {
            return res.status(400).json({ message: 'selfieBase64 and songTitle are required' });
        }
        const base64Data = String(selfieBase64).replace(/^data:image\/\w+;base64,/, '');
        const mimeType = (String(selfieBase64).match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';

        const styleKey = (String(style || '').toLowerCase() || 'illustration').replace(/\s+/g, '_');
        const styleDesc = COVER_STYLES[styleKey] || COVER_STYLES.illustration;

        const customPrompts = Array.isArray(coverPrompts)
            ? coverPrompts.filter(Boolean).map(String).join('. ')
            : '';

        const albumPrompt = `Using this photo as the only reference for the person, create a SQUARE personalized music album cover for the worship song "${songTitle}".
The cover must be square (1:1). Feature the person from the photo as the main subject, styled as a music album cover.
IMPORTANT: Include the song title "${songTitle}" as text overlay on the cover (e.g. at top or bottom, readable and decorative).
${customPrompts ? `Scene requirements: ${customPrompts}.` : ''}
Style: ${styleDesc} Vibrant colors, child-friendly, worship/faith themed, suitable for ages 4–12.`;

        let imageBase64 = null;

        // Try Vertex AI first
        const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (credentialsJson) {
            try {
                const credentials = JSON.parse(credentialsJson);
                const projectId = credentials.project_id || process.env.GCS_PROJECT_ID;
                const { GoogleAuth } = require('google-auth-library');
                const auth = new (require('google-auth-library').GoogleAuth)({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                const client = await auth.getClient();
                const token = await client.getAccessToken();
                const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.token}` },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: albumPrompt }, { inlineData: { mimeType, data: base64Data } }] }],
                        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } },
                    }),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const parts = data.candidates?.[0]?.content?.parts || [];
                    for (const p of parts) {
                        if (p.inlineData?.data) {
                            imageBase64 = p.inlineData.data;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Karaoke album cover Vertex error:', e?.message);
            }
        }

        // Fallback: Consumer Gemini
        if (!imageBase64 && process.env.GEMINI_API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: [{ text: albumPrompt }, { inlineData: { mimeType, data: base64Data } }],
                });
                const parts = response.candidates?.[0]?.content?.parts || [];
                for (const p of parts) {
                    if (p.inlineData?.data) {
                        imageBase64 = p.inlineData.data;
                        break;
                    }
                }
            } catch (e) {
                console.warn('Karaoke album cover Gemini error:', e?.message);
            }
        }

        if (!imageBase64) {
            return res.status(503).json({ message: 'Album cover generation is not available. Ensure GCS_CREDENTIALS_JSON or GEMINI_API_KEY is set.' });
        }

        let imageUrl = null;
        if (bucket) {
            const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
            const filename = `karaoke/album-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const file = bucket.file(filename);
            await file.save(Buffer.from(imageBase64, 'base64'), { contentType: mimeType, metadata: { cacheControl: 'public, max-age=31536000' } });
            // Skip makePublic() - fails with uniform bucket-level access
            imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        } else {
            imageUrl = `data:${mimeType};base64,${imageBase64}`;
        }
        res.json({ imageUrl });
    } catch (err) {
        console.error('Karaoke album cover error:', err);
        res.status(500).json({ message: err.message || 'Album cover generation failed' });
    }
});

// POST /api/karaoke/mix - mix background + recording, return mixed URL
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

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

const REVERB_AECHO = {
    0: null,
    1: '0.8:0.9:50:0.3',
    2: '0.8:0.88:60:0.45:100:0.35',
    3: '0.8:0.85:60:0.5:120:0.4:180:0.3',
};

router.post('/mix', mixMulter.single('recording'), async (req, res) => {
    try {
        const { karaokeSongId } = req.body;
        const reverbLevel = Math.min(3, Math.max(0, parseInt(req.body.reverbLevel, 10) || 0));
        const musicVolume = Math.min(1, Math.max(0, parseFloat(req.body.musicVolume) || 0.45));
        const voiceVolume = Math.min(1, Math.max(0, parseFloat(req.body.voiceVolume) || 1));
        // Seconds into music when recording started (iOS: playback starts before mic, so recording begins late)
        const recordingStartOffset = Math.max(0, Math.min(10, parseFloat(req.body.recordingStartOffset) || 0));
        if (!karaokeSongId || !req.file) {
            return res.status(400).json({ message: 'karaokeSongId and recording file are required' });
        }

        const song = await KaraokeSong.findById(karaokeSongId);
        const audioSourceUrl = song?.backgroundAudioUrl || song?.videoUrl;
        if (!song || !audioSourceUrl) {
            return res.status(400).json({ message: 'Song not found or has no background audio or video' });
        }

        if (!ffmpegAvailable || !bucket) {
            return res.status(503).json({ message: 'Audio mixing is not available' });
        }

        const axios = require('axios');
        const resp = await axios.get(audioSourceUrl, { responseType: 'arraybuffer' });
        const sourceBuffer = Buffer.from(resp.data);

        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'karaoke-'));
        const isVideo = !song.backgroundAudioUrl && song.videoUrl;
        const ext = isVideo ? (audioSourceUrl.includes('.webm') ? 'webm' : 'mp4') : 'mp3';
        const sourcePath = path.join(tmpDir, `source.${ext}`);
        const bgPath = path.join(tmpDir, 'background.mp3');
        const rawRecPath = path.join(tmpDir, 'recording_raw');
        const recWavPath = path.join(tmpDir, 'recording.wav');
        const outPath = path.join(tmpDir, 'mixed.mp3');

        try {
            await fs.promises.writeFile(sourcePath, sourceBuffer);
            if (!song.backgroundAudioUrl && song.videoUrl) {
                await new Promise((resolve, reject) => {
                    ffmpeg(sourcePath).noVideo().audioCodec('libmp3lame').output(bgPath).on('error', reject).on('end', resolve).run();
                });
            } else {
                await fs.promises.copyFile(sourcePath, bgPath);
            }

            // Save recording with NO extension so FFmpeg auto-probes the format
            // from content instead of relying on extension (iOS=MP4, Chrome=WebM).
            await fs.promises.writeFile(rawRecPath, req.file.buffer);
            console.log(`🎤 Recording: ${(req.file.buffer.length / 1024).toFixed(1)}KB, originalname: ${req.file.originalname}`);

            // Convert recording to WAV first - this eliminates ALL format detection
            // issues. FFmpeg auto-probes the raw file, outputs universal PCM WAV.
            await new Promise((resolve, reject) => {
                ffmpeg(rawRecPath)
                    .inputOptions(['-analyzeduration', '20000000', '-probesize', '20000000'])
                    .audioCodec('pcm_s16le')
                    .audioChannels(1)
                    .audioFrequency(44100)
                    .output(recWavPath)
                    .on('error', (err) => {
                        console.error('FFmpeg WAV conversion error:', err.message);
                        reject(err);
                    })
                    .on('end', resolve)
                    .run();
            });

            // Probe the WAV to log actual duration
            try {
                const wavProbe = await new Promise((resolve, reject) => {
                    ffmpeg(recWavPath).ffprobe((err, data) => (err ? reject(err) : resolve(data)));
                });
                console.log(`🎤 WAV probe: duration=${wavProbe?.format?.duration}s, size=${wavProbe?.format?.size}`);
            } catch (e) { console.warn('WAV probe error:', e.message); }

            // Build FFmpeg filter for mixing
            const aecho = REVERB_AECHO[reverbLevel];
            const offsetMs = Math.round(recordingStartOffset * 1000);
            const delayFilter = offsetMs > 0 ? `[1:a]adelay=${offsetMs}|${offsetMs}[delayed];` : '';
            const voiceInput = offsetMs > 0 ? '[delayed]' : '[1:a]';
            // Boost voice by 3x (≈+10dB) to compensate for quiet iOS mic recordings
            const effectiveVoiceVol = Math.min(3, voiceVolume * 3);
            const volBg = `[0:a]volume=${musicVolume}[bg]`;
            const volVoice = aecho
                ? `${voiceInput}aecho=${aecho}[rev];[rev]volume=${effectiveVoiceVol}[v]`
                : `${voiceInput}volume=${effectiveVoiceVol}[v]`;
            const complexVoice = delayFilter + volVoice;
            const mixFilter = `[bg][v]amix=inputs=2:duration=first[aout]`;
            const complexFilter = `${volBg};${complexVoice};${mixFilter}`;
            console.log(`🎤 Mix filter: ${complexFilter}`);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(bgPath)
                    .input(recWavPath)
                    .complexFilter(complexFilter)
                    .outputOptions(['-map', '[aout]', '-ac', '2', '-b:a', '128k'])
                    .output(outPath)
                    .on('error', (err) => {
                        console.error('FFmpeg mix error:', err.message);
                        reject(err);
                    })
                    .on('end', resolve)
                    .run();
            });

            const mixedBuffer = await fs.promises.readFile(outPath);
            const gcsPath = `karaoke/${karaokeSongId}/recordings/${Date.now()}_mixed.mp3`;
            const blob = bucket.file(gcsPath);
            await blob.save(mixedBuffer, {
                metadata: { contentType: 'audio/mpeg' },
            });
            // Skip makePublic() - fails with uniform bucket-level access; bucket policy handles public read
            const mixedUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;

            let mixedDuration = song.duration;
            try {
                const metadata = await new Promise((resolve, reject) => {
                    ffmpeg(outPath).ffprobe((err, data) => (err ? reject(err) : resolve(data)));
                });
                if (metadata?.format?.duration) {
                    mixedDuration = Math.round(metadata.format.duration * 10) / 10;
                }
            } catch (e) {
                /* ignore */
            }

            await KaraokeSong.findByIdAndUpdate(karaokeSongId, { $inc: { recordCount: 1 } });

            res.json({ mixedAudioUrl: mixedUrl, duration: mixedDuration });
        } finally {
            try {
                // Clean up all possible temp files
                const files = await fs.promises.readdir(tmpDir).catch(() => []);
                for (const f of files) {
                    await fs.promises.unlink(path.join(tmpDir, f)).catch(() => {});
                }
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
        const rawUserId = req.user?.id || req.body.userId;
        const userId = rawUserId ? await resolveUserId(rawUserId) : null;
        const { karaokeSongId, mixedAudioUrl, duration, customCoverImageUrl, artistName } = req.body;

        if (!karaokeSongId || !mixedAudioUrl) {
            return res.status(400).json({ message: 'karaokeSongId and mixedAudioUrl are required' });
        }

        const rec = new KaraokeRecording({
            userId: userId || new mongoose.Types.ObjectId(),
            karaokeSongId,
            mixedAudioUrl,
            duration: duration || 0,
            ...(customCoverImageUrl && { customCoverImageUrl }),
            artistName: (artistName != null && String(artistName).trim()) ? String(artistName).trim() : 'Artist',
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
        const rawUserId = req.user?.id || req.query.userId;
        const userId = rawUserId ? await resolveUserId(rawUserId) : null;
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

// DELETE /api/karaoke/recordings/:recordingId - delete user recording (public, no auth)
router.delete('/recordings/:recordingId', async (req, res) => {
    try {
        const { recordingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(recordingId)) {
            return res.status(400).json({ message: 'Invalid recording ID' });
        }
        const result = await KaraokeRecording.findByIdAndDelete(recordingId);
        if (!result) {
            return res.status(404).json({ message: 'Recording not found' });
        }
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('Karaoke recording delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
