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
            style: 0.2,
            returnBase64: true // Skip GCS so we don't call makePublic() (fails with uniform bucket-level access)
        });
        
        if (result.audioBase64) {
            return res.json({ audioBase64: result.audioBase64 });
        }
        res.json({ audioUrl: result.url });
    } catch (err) {
        console.error('Error generating voice preview:', err);
        const status = err.response?.status;
        const message = err.message || 'Failed to generate preview';
        res.status(status && status >= 400 && status < 600 ? status : 500).json({
            error: message,
            code: err.response?.data?.detail?.code || (err.response?.status === 401 ? 'UNAUTHORIZED' : undefined)
        });
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
        const { ageGroup, goalTag, excludeIds, isIllustrated } = req.query;
        
        const excludeArray = excludeIds ? excludeIds.split(',') : [];
        
        // Parse isIllustrated query param (can be 'true', 'false', or undefined)
        let illustratedFilter;
        if (isIllustrated === 'true') illustratedFilter = true;
        else if (isIllustrated === 'false') illustratedFilter = false;
        
        const story = await DevotionalStory.findRandomMatching({
            ageGroup,
            goalTag,
            excludeIds: excludeArray,
            isIllustrated: illustratedFilter
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
        const { childName, childAge, characterAvatarUrl, voicePreference, characterPoses, originalSelfie, characterStyle } = req.body;
        
        if (!childName) {
            return res.status(400).json({ error: 'Child name is required' });
        }
        
        const story = await DevotionalStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        // Check cache first (include voice preference and selfie hash in cache key)
        const effectiveVoice = voicePreference || story.preferredVoice || 'auto';
        const selfieHash = originalSelfie ? crypto.createHash('md5').update(originalSelfie.slice(0, 100)).digest('hex').slice(0, 8) : 'no-selfie';
        const cacheKey = `${story._id}_${childName}_${effectiveVoice}_${selfieHash}_${story.updatedAt.getTime()}`;
        const cached = personalizedCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`📚 Using cached personalized story for ${childName}`);
            return res.json(cached.data);
        }
        
        console.log(`📚 Personalizing ${story.isIllustrated ? 'illustrated' : 'text'} story "${story.title}" for ${childName}...`);
        
        // Personalize content
        const personalized = story.personalizeContent(childName);
        
        // Prepare TTS text based on story type
        let ttsText;
        if (story.isIllustrated && personalized.pages && personalized.pages.length > 0) {
            // For illustrated stories, combine all page ttsText for narration
            // Add pauses between pages for natural pacing
            ttsText = personalized.pages
                .map(page => page.ttsText || page.textBoxes?.map(tb => tb.text).join(' ') || '')
                .filter(text => text.trim())
                .join(' ... '); // Triple dots for pause
            console.log(`📖 Illustrated story with ${personalized.pages.length} pages`);
        } else {
            // For text-based stories, use single content block
            ttsText = personalized.content;
        }
        
        // Generate TTS audio using ElevenLabs
        // Priority: User's voice preference > Story's default voice > Auto-select
        const voiceId = voicePreference || story.preferredVoice || null;
        let ttsResult = null;
        
        if (ttsText) {
            console.log(`🎙️ Generating ElevenLabs TTS narration (voice: ${voiceId || 'auto'})...`);
            ttsResult = await generateElevenLabsTTS(ttsText, {
                voiceId,
                storagePath: 'devotional-stories/tts',
                filenamePrefix: `story_${story._id}_${childName.replace(/\s+/g, '_')}`,
                stability: 0.5,
                similarityBoost: 0.75,
                style: 0.3 // More expressive for storytelling
            });
        }
        
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
        
        // Generate personalized scene image with child's character from selfie
        let sceneImageUrl = story.sceneImageUrl || null;
        if (originalSelfie && !story.isIllustrated) {
            console.log(`🎨 Generating personalized scene image with ${childName}'s character...`);
            try {
                sceneImageUrl = await generatePersonalizedSceneImage(
                    story._id,
                    childName,
                    originalSelfie,
                    characterStyle || 'illustrated',
                    story.sceneImagePrompt || story.description || story.title,
                    personalized.content
                );
                console.log(`✅ Personalized scene image generated`);
            } catch (sceneErr) {
                console.error('Scene image generation failed, using default:', sceneErr.message);
                // Fall back to story's default scene image if available
                sceneImageUrl = story.sceneImageUrl || null;
            }
        }
        
        // Build result object
        const result = {
            storyId: story._id,
            title: personalized.title,
            scripture: personalized.scripture,
            scriptureText: personalized.scriptureText,
            ttsAudioUrl: ttsResult?.url || null,
            estimatedDuration: ttsResult?.duration || story.estimatedDuration * 60,
            coverImageUrl: coverUrl,
            sceneImageUrl: sceneImageUrl,
            backgroundMusicUrl,
            reflectionQuestions: personalized.reflectionQuestions,
            isIllustrated: story.isIllustrated,
        };
        
        if (story.isIllustrated && personalized.pages) {
            // For illustrated stories, include pages with character info
            // Merge character pose URLs if provided
            result.pages = personalized.pages.map(page => {
                const pageResult = { ...page };
                
                // If client sent characterPoses, add the pose URL to each page
                if (characterPoses && page.showCharacter !== false && page.characterPose && page.characterPose !== 'none') {
                    const poseData = characterPoses[page.characterPose];
                    if (poseData) {
                        pageResult.characterPoseUrl = poseData.url;
                    }
                }
                
                return pageResult;
            });
            result.content = null; // No single content block for illustrated
        } else {
            result.content = personalized.content;
            result.pages = null;
        }
        
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

// Helper: Generate personalized scene image with child's character using Imagen
async function generatePersonalizedSceneImage(storyId, childName, selfieBase64, styleId, scenePrompt, storyContent) {
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
        
        // Style descriptions for character transformation
        const styleDescriptions = {
            minecraft: 'Minecraft blocky pixel art style, cubic shapes, 3D voxel',
            lego: 'LEGO minifigure style, yellow skin, plastic look, brick aesthetic',
            cartoon: 'Cartoon animated style, big expressive eyes, Disney-like',
            illustrated: 'Children\'s book illustration style, soft watercolor, storybook',
            disney: 'Disney/Pixar 3D animation style, expressive, cinematic lighting'
        };
        
        const styleDesc = styleDescriptions[styleId] || styleDescriptions.illustrated;
        
        // Extract key scene elements from story content (first 200 chars for context)
        const storyContext = (storyContent || '').slice(0, 200).replace(/\{childName\}/g, childName);
        
        // Build the prompt for scene generation with child's character.
        // [1] references the subject reference image (required by Imagen API).
        const enhancedPrompt = `A child named ${childName} [1] in a Bible story scene. ${scenePrompt}. 
        The child [1] is the main character in this scene—depict them only from reference [1]; do not add hat or headphones unless visible in the reference. Any other characters (e.g. biblical figures) must not be given the child's modern accessories (no headphones, caps on other figures). ${styleDesc}.
        Story context: ${storyContext}
        Children's book illustration style, warm inviting colors, soft lighting, 
        suitable for ages 4-12, peaceful atmosphere, Christian faith theme.
        Wide scene showing environment with the child [1] as focal point.`;
        
        console.log(`🎨 Generating personalized scene with style: ${styleId}`);
        
        // Clean up selfie base64 (remove data URL prefix if present)
        const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
        
        // Use Imagen with reference image for character consistency (referenceId + subjectImageConfig required)
        const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.token}`
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: enhancedPrompt,
                        referenceImages: [{
                            referenceId: 1,
                            referenceImage: {
                                bytesBase64Encoded: cleanSelfie
                            },
                            referenceType: 'REFERENCE_TYPE_SUBJECT',
                            subjectImageConfig: {
                                subjectDescription: `The person in this photo (${childName}). Match their exact appearance; depict only clothing and accessories visible in the photo—do not add hat or headphones unless they appear in the photo. Transform into ${styleDesc}.`,
                                subjectType: 'SUBJECT_TYPE_PERSON'
                            }
                        }]
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "16:9", // Wide aspect for scene background
                        safetyFilterLevel: "block_some",
                        personGeneration: "allow_adult" // Allow since we're transforming child to character
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Imagen API error:', errorText);
            // Fallback to generation without reference image
            return await generateSceneImageFallback(storyId, childName, enhancedPrompt, token.token, projectId);
        }
        
        const data = await response.json();
        
        if (!data.predictions || !data.predictions[0]) {
            console.log('No image with reference, trying fallback...');
            return await generateSceneImageFallback(storyId, childName, enhancedPrompt, token.token, projectId);
        }
        
        const imageBase64 = data.predictions[0].bytesBase64Encoded;
        const buffer = Buffer.from(imageBase64, 'base64');
        
        // Save to GCS
        const hash = crypto.createHash('md5').update(storyId + childName + Date.now()).digest('hex').slice(0, 12);
        const filename = `devotional-stories/personalized-scenes/scene_${storyId}_${childName.replace(/\s+/g, '_')}_${hash}.png`;
        
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
        console.error('Personalized scene generation error:', err.message);
        throw err;
    }
}

// Fallback scene generation without reference image
async function generateSceneImageFallback(storyId, childName, prompt, accessToken, projectId) {
    const response = await fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "16:9",
                    safetyFilterLevel: "block_some",
                    personGeneration: "dont_allow"
                }
            })
        }
    );
    
    if (!response.ok) {
        throw new Error('Fallback scene generation failed');
    }
    
    const data = await response.json();
    
    if (!data.predictions || !data.predictions[0]) {
        throw new Error('No image generated in fallback');
    }
    
    const imageBase64 = data.predictions[0].bytesBase64Encoded;
    const buffer = Buffer.from(imageBase64, 'base64');
    
    // Save to GCS
    const hash = crypto.createHash('md5').update(storyId + childName + Date.now()).digest('hex').slice(0, 12);
    const filename = `devotional-stories/personalized-scenes/scene_${storyId}_fallback_${hash}.png`;
    
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

// POST /api/devotional-stories/:id/generate-scene
// Generate AI scene image for audio story player
router.post('/:id/generate-scene', async (req, res) => {
    try {
        const { customPrompt } = req.body;
        
        const story = await DevotionalStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        // Build prompt from story content or use custom prompt
        let basePrompt = customPrompt || story.sceneImagePrompt;
        
        if (!basePrompt) {
            // Auto-generate prompt from story details
            const storyContent = story.content || story.description || '';
            const contentPreview = storyContent.slice(0, 200).replace(/\{childName\}/g, 'a child');
            
            basePrompt = `${story.title.replace(/\{childName\}/g, 'a child')}: ${contentPreview}`;
        }
        
        const enhancedPrompt = `${basePrompt}. 
        Children's book illustration style, beautiful warm colors, inviting scene, 
        Bible story setting, soft lighting, suitable for children ages 4-12, 
        no text overlays, peaceful atmosphere, Christian faith theme.`;
        
        console.log(`🎨 Generating scene image for story "${story.title}"...`);
        console.log(`📝 Prompt: ${enhancedPrompt.slice(0, 200)}...`);
        
        const sceneImageUrl = await generateSceneImage(story._id, enhancedPrompt);
        
        // Save the scene image URL and prompt to the story
        story.sceneImageUrl = sceneImageUrl;
        if (customPrompt) {
            story.sceneImagePrompt = customPrompt;
        }
        await story.save();
        
        console.log(`✅ Scene image generated: ${sceneImageUrl}`);
        
        res.json({ 
            story,
            sceneImageUrl 
        });
    } catch (err) {
        console.error('Error generating scene image:', err);
        res.status(500).json({ error: 'Failed to generate scene image', message: err.message });
    }
});

// Helper: Generate scene image using Imagen
async function generateSceneImage(storyId, prompt) {
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
        
        const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.token}`
                },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "16:9", // Wide aspect for background
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
        const hash = crypto.createHash('md5').update(storyId + Date.now()).digest('hex').slice(0, 12);
        const filename = `devotional-stories/scenes/scene_${storyId}_${hash}.png`;
        
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
        console.error('Scene image generation error:', err.message);
        throw err;
    }
}

module.exports = router;
