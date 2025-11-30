require('dotenv').config(); // Ensure env vars are loaded
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { bucket } = require('../config/storage');
const TTSCache = require('../models/TTSCache');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper to save buffer to file (Local or GCS)
const saveAudioFile = async (buffer, filename, bookId = null) => {
    const filePath = bookId ? `books/${bookId}/audio/${filename}` : `audio/${filename}`;

    // Check if GCS is configured
    if (bucket && process.env.GCS_BUCKET_NAME) {
        return new Promise((resolve, reject) => {
            const blob = bucket.file(filePath);
            const blobStream = blob.createWriteStream({
                metadata: {
                    contentType: 'audio/mpeg',
                },
            });

            blobStream.on('error', (error) => {
                console.error('GCS Upload error:', error);
                // Fallback to local
                saveLocal(buffer, filePath).then(resolve).catch(reject);
            });

            blobStream.on('finish', () => {
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                resolve(publicUrl);
            });

            blobStream.end(buffer);
        });
    } else {
        return saveLocal(buffer, filePath);
    }
};

const saveLocal = (buffer, gcsPath) => {
    return new Promise((resolve, reject) => {
        const localPath = path.join(uploadsDir, gcsPath);
        const dir = path.dirname(localPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFile(localPath, buffer, (err) => {
            if (err) reject(err);
            else resolve(`/uploads/${gcsPath}`);
        });
    });
};

// POST /generate - Generate TTS audio
router.post('/generate', async (req, res) => {
    try {
        const { text, voiceId, bookId } = req.body;

        if (!text || !voiceId) {
            return res.status(400).json({ message: 'Text and voiceId are required' });
        }

        // 1. Check Cache
        const textHash = crypto.createHash('md5').update(text + voiceId).digest('hex');
        const cached = await TTSCache.findOne({ textHash, voiceId });

        if (cached) {
            console.log('TTS Cache Hit');
            return res.json({
                audioUrl: cached.audioUrl,
                alignment: cached.alignmentData
            });
        }

        console.log('TTS Cache Miss - Generating Audio');
        let audioBuffer;

        // CHECK IF LOCAL VOICE (Custom Clone)
        if (voiceId.startsWith('local_')) {
            console.log('🎤 Using Local Python AI Service for Voice Clone:', voiceId);

            // Find the reference audio file
            const voicesDir = path.join(uploadsDir, 'voices');
            const files = fs.readdirSync(voicesDir);
            const referenceFile = files.find(f => f.startsWith(voiceId));

            if (!referenceFile) {
                throw new Error(`Local voice reference file not found for ID: ${voiceId}`);
            }

            const referencePath = path.join(voicesDir, referenceFile);
            console.log('📄 Reference Audio:', referencePath);

            // Call Python Service
            const formData = new FormData();
            formData.append('text', text);
            formData.append('language', 'en');
            formData.append('speaker_wav', fs.createReadStream(referencePath));

            try {
                const pythonResponse = await axios.post('http://localhost:8000/generate', formData, {
                    headers: {
                        ...formData.getHeaders()
                    },
                    responseType: 'arraybuffer'
                });

                audioBuffer = pythonResponse.data;
                console.log('✅ Python Service Generation Successful');
            } catch (pyError) {
                console.error('❌ Python Service Error:', pyError.message);
                if (pyError.code === 'ECONNREFUSED') {
                    throw new Error('Local AI Service is offline. Please start the Python service.');
                }
                throw pyError;
            }

        } else {
            // ELEVENLABS GENERATION
            const apiKey = process.env.ELEVENLABS_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ message: 'TTS Generation Failed', error: 'apiKey is not defined' });
            }

            const modelId = "eleven_v3";
            console.log('🎤 Generating TTS with ElevenLabs model:', modelId);

            try {
                const response = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    {
                        text,
                        model_id: modelId,
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    },
                    {
                        headers: {
                            'xi-api-key': apiKey,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        responseType: 'arraybuffer',
                        params: {
                            output_format: 'mp3_44100_128',
                            enable_logging: false
                        }
                    }
                );
                audioBuffer = response.data;
            } catch (error) {
                console.error('❌ ElevenLabs API Error:', error.response?.status);
                throw error;
            }
        }

        // 3. Save Audio
        const filename = `${Date.now()}_${textHash}.mp3`;
        const audioUrl = await saveAudioFile(audioBuffer, filename, bookId);

        // 4. Generate word-level alignment data (Estimate)
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const estimatedDurationPerWord = 0.4; // seconds

        const alignmentData = {
            words: words.map((word, index) => {
                const startTime = index * estimatedDurationPerWord;
                const endTime = (index + 1) * estimatedDurationPerWord;
                return {
                    word: word,
                    start: startTime,
                    end: endTime
                };
            }),
            characters: [],
            character_start_times_seconds: [],
            character_end_times_seconds: []
        };

        // 5. Save to Cache
        const newCache = new TTSCache({
            textHash,
            voiceId,
            text,
            audioUrl,
            alignmentData
        });
        await newCache.save();

        res.json({
            audioUrl,
            alignment: alignmentData
        });

    } catch (error) {
        console.error('TTS Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'TTS Generation Failed', error: error.message });
    }
});

// GET /voices - Get available voices
router.get('/voices', async (req, res) => {
    try {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'ElevenLabs API key not configured' });
        }

        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey }
        });

        const voices = response.data.voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url,
            category: v.category
        }));

        res.json(voices);
    } catch (error) {
        console.error('Fetch Voices Error:', error.message);
        res.status(500).json({ message: 'Failed to fetch voices' });
    }
});

module.exports = router;
