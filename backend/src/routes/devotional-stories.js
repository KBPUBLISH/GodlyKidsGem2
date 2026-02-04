const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const DevotionalStory = require('../models/DevotionalStory');
const BackgroundMusic = require('../models/BackgroundMusic');
const { bucket } = require('../config/storage');
const { generateElevenLabsTTS, getVoiceOptions, VOICE_OPTIONS } = require('../utils/elevenLabsTTS');

// Cache for personalized content (to avoid regenerating same content)
const personalizedCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of personalizedCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            personalizedCache.delete(key);
        }
    }
}, 60 * 60 * 1000); // Every hour

// GET /api/devotional-stories/voices
// Get available ElevenLabs voices for story narration
router.get('/voices', (req, res) => {
    res.json({ voices: VOICE_OPTIONS });
});

// POST /api/devotional-stories/preview-voice
// Generate a short TTS preview for voice selection
router.post('/preview-voice', async (req, res) => {
    try {
        const { voiceId, text } = req.body;
        
        if (!voiceId || !text) {
            return res.status(400).json({ error: 'voiceId and text are required' });
        }
        
        // Limit preview text length
        const previewText = text.slice(0, 200);
        
        console.log(`🎙️ Generating voice preview for ${voiceId}...`);
        
        const result = await generateElevenLabsTTS(previewText, {
            voiceId,
            storagePath: 'devotional-stories/previews',
            filenamePrefix: `preview_${voiceId.slice(0, 8)}`,
            stability: 0.5,
            similarityBoost: 0.75,
            style: 0.2
        });
        
        res.json({ audioUrl: result.url });
    } catch (err) {
        console.error('Error generating voice preview:', err);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// GET /api/devotional-stories
// List all stories (for portal)
router.get('/', async (req, res) => {
    try {
        const { status, ageGroup, goalTag, page = 1, limit = 20 } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (ageGroup) query.ageGroups = ageGroup;
        if (goalTag) query.goalTags = goalTag;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [stories, total] = await Promise.all([
            DevotionalStory.find(query)
                .sort({ order: 1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            DevotionalStory.countDocuments(query)
        ]);
        
        res.json({
            stories,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching stories:', err);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// GET /api/devotional-stories/random
// Get a random story matching criteria (for app)
router.get('/random', async (req, res) => {
    try {
        const { ageGroup, goalTag, excludeIds } = req.query;
        
        const excludeArray = excludeIds ? excludeIds.split(',') : [];
        
        const story = await DevotionalStory.findRandomMatching({
            ageGroup,
            goalTag,
            excludeIds: excludeArray
        });
        
        if (!story) {
            return res.status(404).json({ error: 'No matching story found' });
        }
        
        // Increment play count
        await DevotionalStory.updateOne(
            { _id: story._id },
            { $inc: { playCount: 1 } }
        );
        
        res.json({ story });
    } catch (err) {
        console.error('Error finding random story:', err);
        res.status(500).json({ error: 'Failed to find story' });
    }
});

// GET /api/devotional-stories/:id
// Get single story
router.get('/:id', async (req, res) => {
    try {
        const story = await DevotionalStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json({ story });
    } catch (err) {
        console.error('Error fetching story:', err);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// POST /api/devotional-stories
// Create new story (portal)
router.post('/', async (req, res) => {
    try {
        const story = new DevotionalStory(req.body);
        await story.save();
        res.status(201).json({ story });
    } catch (err) {
        console.error('Error creating story:', err);
        res.status(500).json({ error: 'Failed to create story' });
    }
});

// PUT /api/devotional-stories/:id
// Update story (portal)
router.put('/:id', async (req, res) => {
    try {
        const story = await DevotionalStory.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json({ story });
    } catch (err) {
        console.error('Error updating story:', err);
        res.status(500).json({ error: 'Failed to update story' });
    }
});

// DELETE /api/devotional-stories/:id
// Delete story (portal)
router.delete('/:id', async (req, res) => {
    try {
        const story = await DevotionalStory.findByIdAndDelete(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json({ message: 'Story deleted' });
    } catch (err) {
        console.error('Error deleting story:', err);
        res.status(500).json({ error: 'Failed to delete story' });
    }
});

// POST /api/devotional-stories/:id/personalize
// Generate personalized story content with TTS and cover
router.post('/:id/personalize', async (req, res) => {
    try {
        const { childName, childAge, characterAvatarUrl, voicePreference } = req.body;
        
        if (!childName) {
            return res.status(400).json({ error: 'Child name is required' });
        }
        
        const story = await DevotionalStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        // Check cache first (include voice preference in cache key)
        const effectiveVoice = voicePreference || story.preferredVoice || 'auto';
        const cacheKey = `${story._id}_${childName}_${effectiveVoice}_${story.updatedAt.getTime()}`;
        const cached = personalizedCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`📚 Using cached personalized story for ${childName}`);
            return res.json(cached.data);
        }
        
        console.log(`📚 Personalizing story "${story.title}" for ${childName}...`);
        
        // Personalize content
        const personalized = story.personalizeContent(childName);
        
        // Generate TTS audio using ElevenLabs
        // Priority: User's voice preference > Story's default voice > Auto-select
        const voiceId = voicePreference || story.preferredVoice || null;
        console.log(`🎙️ Generating ElevenLabs TTS narration (voice: ${voiceId || 'auto'})...`);
        const ttsResult = await generateElevenLabsTTS(personalized.content, {
            voiceId,
            storagePath: 'devotional-stories/tts',
            filenamePrefix: `story_${story._id}_${childName.replace(/\s+/g, '_')}`,
            stability: 0.5,
            similarityBoost: 0.75,
            style: 0.3 // More expressive for storytelling
        });
        
        // Generate cover image if we have character avatar
        let coverUrl = story.defaultCoverUrl;
        if (characterAvatarUrl && story.coverPrompt) {
            console.log('🎨 Generating personalized cover...');
            try {
                coverUrl = await generatePersonalizedCover(
                    story._id,
                    childName,
                    story.coverPrompt,
                    characterAvatarUrl
                );
            } catch (coverErr) {
                console.error('Cover generation failed, using default:', coverErr.message);
            }
        }
        
        // Get background music - either from story or auto-select from library
        let backgroundMusicUrl = story.backgroundMusicUrl;
        if (!backgroundMusicUrl && story.goalTags && story.goalTags.length > 0) {
            console.log('🎵 Auto-selecting background music for goals:', story.goalTags);
            try {
                const music = await BackgroundMusic.findForGoals(story.goalTags);
                if (music) {
                    backgroundMusicUrl = music.audioUrl;
                    console.log(`🎵 Auto-selected music: ${music.name}`);
                }
            } catch (musicErr) {
                console.error('Failed to auto-select music:', musicErr.message);
            }
        }
        
        const result = {
            storyId: story._id,
            title: personalized.title,
            content: personalized.content,
            scripture: personalized.scripture,
            scriptureText: personalized.scriptureText,
            ttsAudioUrl: ttsResult?.url || null,
            estimatedDuration: ttsResult?.duration || story.estimatedDuration * 60,
            coverImageUrl: coverUrl,
            backgroundMusicUrl,
            reflectionQuestions: personalized.reflectionQuestions,
        };
        
        // Cache the result
        personalizedCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
        
        console.log(`✅ Story personalized for ${childName}`);
        res.json(result);
        
    } catch (err) {
        console.error('Error personalizing story:', err);
        res.status(500).json({ error: 'Failed to personalize story', message: err.message });
    }
});

// Helper: Generate personalized cover using Imagen
async function generatePersonalizedCover(storyId, childName, coverPrompt, characterAvatarUrl) {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
        throw new Error('GCS credentials not configured');
    }
    
    try {
        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        // Get access token
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        
        // Create prompt that incorporates the story context
        const enhancedPrompt = `${coverPrompt.replace(/\{childName\}/g, childName)}. 
        Children's book cover style, vibrant colors, whimsical, age-appropriate, 
        inspiring, Christian faith theme, warm lighting, magical atmosphere.`;
        
        const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.token}`
                },
                body: JSON.stringify({
                    instances: [{ prompt: enhancedPrompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1",
                        safetyFilterLevel: "block_some",
                        personGeneration: "dont_allow" // Safer for children's content
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Imagen API error: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.predictions || !data.predictions[0]) {
            throw new Error('No image generated');
        }
        
        const imageBase64 = data.predictions[0].bytesBase64Encoded;
        const buffer = Buffer.from(imageBase64, 'base64');
        
        // Save to GCS
        const hash = crypto.createHash('md5').update(storyId + childName + Date.now()).digest('hex').slice(0, 12);
        const filename = `devotional-stories/covers/cover_${storyId}_${hash}.png`;
        
        if (bucket) {
            const blob = bucket.file(filename);
            await blob.save(buffer, {
                metadata: {
                    contentType: 'image/png',
                    cacheControl: 'public, max-age=86400'
                }
            });
            await blob.makePublic();
            
            return `https://storage.googleapis.com/${bucket.name}/${filename}`;
        }
        
        throw new Error('GCS bucket not available');
    } catch (err) {
        console.error('Cover generation error:', err.message);
        throw err;
    }
}

// PUT /api/devotional-stories/reorder
// Reorder stories (portal)
router.put('/reorder', async (req, res) => {
    try {
        const { orderedIds } = req.body;
        
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds array required' });
        }
        
        // Update order for each story
        const updates = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: mongoose.Types.ObjectId(id) },
                update: { order: index }
            }
        }));
        
        await DevotionalStory.bulkWrite(updates);
        
        res.json({ message: 'Order updated' });
    } catch (err) {
        console.error('Error reordering stories:', err);
        res.status(500).json({ error: 'Failed to reorder stories' });
    }
});

// POST /api/devotional-stories/:id/upload-music
// Upload background music for a story
router.post('/:id/upload-music', async (req, res) => {
    try {
        const { musicBase64, filename } = req.body;
        
        if (!musicBase64) {
            return res.status(400).json({ error: 'Music file is required' });
        }
        
        const story = await DevotionalStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        // Remove data URL prefix if present
        const base64Data = musicBase64.replace(/^data:audio\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine content type from filename
        const ext = filename?.split('.').pop()?.toLowerCase() || 'mp3';
        const contentType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
        
        // Save to GCS
        const gcsFilename = `devotional-stories/music/${story._id}_${Date.now()}.${ext}`;
        
        if (bucket) {
            const blob = bucket.file(gcsFilename);
            await blob.save(buffer, {
                metadata: {
                    contentType,
                    cacheControl: 'public, max-age=31536000'
                }
            });
            await blob.makePublic();
            
            const musicUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFilename}`;
            
            // Update story with music URL
            story.backgroundMusicUrl = musicUrl;
            await story.save();
            
            res.json({ 
                story,
                backgroundMusicUrl: musicUrl 
            });
        } else {
            res.status(500).json({ error: 'Storage not configured' });
        }
    } catch (err) {
        console.error('Error uploading music:', err);
        res.status(500).json({ error: 'Failed to upload music' });
    }
});

module.exports = router;
