const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

require('dotenv').config();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to convert audio to MP3
const convertToMP3 = (inputBuffer, inputFormat) => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const tempInputPath = path.join(uploadsDir, `temp_input_${timestamp}_${random}.${inputFormat}`);
        const tempOutputPath = path.join(uploadsDir, `temp_output_${timestamp}_${random}.mp3`);

        // Write input buffer to temp file
        fs.writeFileSync(tempInputPath, inputBuffer);

        ffmpeg(tempInputPath)
            .toFormat('mp3')
            .audioCodec('libmp3lame')
            .audioBitrate(128)
            .audioChannels(1)
            .audioFrequency(22050)
            .on('end', () => {
                // Read converted file
                const convertedBuffer = fs.readFileSync(tempOutputPath);

                // Clean up temp files
                try {
                    fs.unlinkSync(tempInputPath);
                    fs.unlinkSync(tempOutputPath);
                } catch (err) {
                    console.warn('Failed to clean up temp files:', err);
                }

                resolve(convertedBuffer);
            })
            .on('error', (err) => {
                // Clean up temp files on error
                try {
                    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
                    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
                } catch (cleanupErr) {
                    console.warn('Failed to clean up temp files:', cleanupErr);
                }

                reject(err);
            })
            .save(tempOutputPath);
    });
};

// Check if format needs conversion (ElevenLabs supports: mp3, wav, ogg)
const needsConversion = (mimetype, filename) => {
    if (!mimetype && !filename) return true; // Unknown format, convert to be safe

    const supportedFormats = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/ogg', 'audio/oga'];
    const supportedExtensions = ['.mp3', '.wav', '.ogg'];

    if (mimetype) {
        if (supportedFormats.some(f => mimetype.includes(f))) {
            return false;
        }
    }

    if (filename) {
        const ext = path.extname(filename).toLowerCase();
        if (supportedExtensions.includes(ext)) {
            return false;
        }
    }

    return true; // Needs conversion
};

// POST /clone - Clone a voice from audio samples using ElevenLabs
router.post('/clone', upload.array('samples', 10), async (req, res) => {
    try {
        const { name, description } = req.body;
        const files = req.files;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ message: 'ElevenLabs API key not configured' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Voice name is required' });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'At least one audio sample is required' });
        }

        // Prepare files for ElevenLabs API
        // ElevenLabs expects files in a specific format
        const processedFiles = [];
        for (const file of files) {
            // Check if file needs conversion
            const needsConv = needsConversion(file.mimetype, file.originalname);
            let fileBuffer = file.buffer;
            let fileName = file.originalname;

            if (needsConv) {
                // Convert to MP3
                const inputFormat = path.extname(file.originalname).slice(1) || 'wav';
                try {
                    fileBuffer = await convertToMP3(file.buffer, inputFormat);
                    fileName = fileName.replace(/\.[^/.]+$/, '.mp3');
                } catch (convError) {
                    console.warn(`Failed to convert ${file.originalname}, using original:`, convError);
                }
            }

            processedFiles.push({
                name: fileName,
                data: fileBuffer
            });
        }

        // Create FormData for ElevenLabs
        const formData = new FormData();
        formData.append('name', name);
        if (description) {
            formData.append('description', description);
        }
        
        // Add all audio files
        processedFiles.forEach((file) => {
            formData.append('files', file.data, {
                filename: file.name,
                contentType: 'audio/mpeg'
            });
        });

        // Call ElevenLabs API to clone voice
        console.log(`🎤 Cloning voice "${name}" with ${processedFiles.length} sample(s) via ElevenLabs...`);
        const response = await axios.post('https://api.elevenlabs.io/v1/voices/add', formData, {
            headers: {
                'xi-api-key': apiKey,
                ...formData.getHeaders()
            }
        });

        const voiceData = response.data;
        console.log(`✅ Voice cloned successfully: ${voiceData.voice_id}`);

        res.json({
            success: true,
            voice: {
                voice_id: voiceData.voice_id,
                name: voiceData.name || name,
                description: voiceData.description || description || 'Custom cloned voice',
                category: 'cloned',
                preview_url: voiceData.preview_url || null
            }
        });

    } catch (error) {
        console.error('❌ ElevenLabs Voice Cloning Error:', error.response?.data || error.message);
        res.status(500).json({
            message: 'Failed to clone voice',
            error: error.response?.data?.message || error.message
        });
    }
});

// DELETE /clone/:voiceId - Delete a cloned voice
router.delete('/clone/:voiceId', async (req, res) => {
    try {
        const { voiceId } = req.params;

        // Check if this is an old local voice (starts with 'local_')
        if (voiceId.startsWith('local_')) {
            // For old local voices, just delete the local file and return success
            // (The frontend will handle removing it from localStorage)
            const voicesDir = path.join(uploadsDir, 'voices');
            if (fs.existsSync(voicesDir)) {
                const files = fs.readdirSync(voicesDir);
                const voiceFile = files.find(f => f.startsWith(voiceId));
                if (voiceFile) {
                    const filePath = path.join(voicesDir, voiceFile);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`✅ Deleted local voice file: ${filePath}`);
                    } catch (fileError) {
                        console.warn(`⚠️ Could not delete local voice file: ${fileError.message}`);
                    }
                }
            }
            return res.json({ success: true, message: 'Local voice deleted successfully' });
        }

        // For ElevenLabs voices, delete from their API
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'ElevenLabs API key not configured' });
        }

        // Delete voice from ElevenLabs
        await axios.delete(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
            headers: {
                'xi-api-key': apiKey
            }
        });

        res.json({ success: true, message: 'Voice deleted successfully' });
    } catch (error) {
        console.error('Delete Voice Error:', error.response?.data || error.message);
        
        // If it's a 404, the voice might not exist in ElevenLabs (could be old local voice)
        // Still return success so frontend can clean up localStorage
        if (error.response?.status === 404) {
            console.warn(`⚠️ Voice ${req.params.voiceId} not found in ElevenLabs, treating as deleted`);
            return res.json({ success: true, message: 'Voice deleted successfully' });
        }

        res.status(500).json({
            message: 'Failed to delete voice',
            error: error.response?.data?.message || error.message
        });
    }
});

module.exports = router;

