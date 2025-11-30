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

// POST /clone - Clone a voice from audio samples (LOCAL STORAGE VERSION)
router.post('/clone', upload.array('samples', 10), async (req, res) => {
    try {
        const { name, description } = req.body;
        const files = req.files;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Voice name is required' });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'At least one audio sample is required' });
        }

        // Ensure voices directory exists
        const voicesDir = path.join(uploadsDir, 'voices');
        if (!fs.existsSync(voicesDir)) {
            fs.mkdirSync(voicesDir, { recursive: true });
        }

        // Generate a unique local voice ID
        const voiceId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // We'll use the first file as the reference audio for XTTS
        // In a more advanced version, we could merge them or pick the best one
        const referenceFile = files[0];
        const fileExt = path.extname(referenceFile.originalname) || '.wav';
        const fileName = `${voiceId}${fileExt}`;
        const filePath = path.join(voicesDir, fileName);

        // Write the file to disk
        fs.writeFileSync(filePath, referenceFile.buffer);
        console.log(`✅ Saved local voice reference: ${filePath}`);

        // Return success with the local voice ID
        res.json({
            success: true,
            voice: {
                voice_id: voiceId,
                name: name,
                description: description || 'Custom local voice',
                category: 'cloned',
                preview_url: null // We could generate one later
            }
        });

    } catch (error) {
        console.error('❌ Local Voice Cloning Error:', error);
        res.status(500).json({
            message: 'Failed to save local voice',
            error: error.message
        });
    }
});

// DELETE /clone/:voiceId - Delete a cloned voice
router.delete('/clone/:voiceId', async (req, res) => {
    try {
        const { voiceId } = req.params;
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
        res.status(500).json({
            message: 'Failed to delete voice',
            error: error.response?.data?.message || error.message
        });
    }
});

module.exports = router;

