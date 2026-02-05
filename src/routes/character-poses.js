const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { bucket } = require('../config/storage');

// ===========================================
// CHARACTER POSE DEFINITIONS
// ===========================================

// Define the 10 poses we generate for each character
const POSE_DEFINITIONS = {
    standing_front: {
        name: 'Standing Front',
        prompt: 'full body character standing facing forward, neutral friendly expression, arms relaxed at sides',
        description: 'Default standing pose'
    },
    standing_happy: {
        name: 'Standing Happy',
        prompt: 'full body character standing with arms raised up in celebration, big joyful smile, excited expression',
        description: 'Celebrating or excited'
    },
    sitting: {
        name: 'Sitting',
        prompt: 'full body character sitting cross-legged on the ground, relaxed comfortable pose, gentle smile',
        description: 'Sitting and relaxed'
    },
    reading: {
        name: 'Reading',
        prompt: 'full body character holding and reading an open book, focused interested expression, standing or sitting',
        description: 'Reading a book or Bible'
    },
    praying: {
        name: 'Praying',
        prompt: 'full body character with hands pressed together in prayer position, eyes closed, peaceful serene expression',
        description: 'Praying pose'
    },
    walking: {
        name: 'Walking',
        prompt: 'full body character in mid-walk pose from side angle, one leg forward, arms swinging naturally, looking ahead',
        description: 'Walking or on a journey'
    },
    thinking: {
        name: 'Thinking',
        prompt: 'full body character with finger on chin, looking upward thoughtfully, curious contemplative expression',
        description: 'Thinking or wondering'
    },
    pointing: {
        name: 'Pointing',
        prompt: 'full body character pointing forward with one arm extended, confident expression, other hand on hip',
        description: 'Pointing at something'
    },
    waving: {
        name: 'Waving',
        prompt: 'full body character waving hello with one hand raised, friendly welcoming smile, other arm relaxed',
        description: 'Waving hello or goodbye'
    },
    celebrating: {
        name: 'Celebrating',
        prompt: 'full body character jumping with both arms raised high, huge excited smile, dynamic joyful pose',
        description: 'Jumping for joy'
    }
};

// Style base prompts (to combine with pose prompts)
// Limited to 5 styles to optimize costs and user experience
const STYLE_BASES = {
    minecraft: {
        base: 'Minecraft-style blocky pixelated character, cubic voxel art, square head and body',
        suffix: 'game-ready character, transparent background, PNG',
        negativePrompt: 'realistic, smooth, round, detailed, photograph, blurry, background',
        displayName: 'Minecraft',
        emoji: '⛏️'
    },
    lego: {
        base: 'LEGO minifigure style character, yellow plastic skin, simple features, cylindrical head',
        suffix: 'toy-like appearance, transparent background, PNG',
        negativePrompt: 'realistic skin tone, complex features, photograph, scary, background',
        displayName: 'LEGO',
        emoji: '🧱'
    },
    cartoon: {
        base: 'cute 2D cartoon character, big expressive eyes, simplified features, animated style',
        suffix: 'clean lines, bright colors, transparent background, PNG',
        negativePrompt: 'realistic, 3D, photograph, scary, complex shading, background',
        displayName: 'Cartoon',
        emoji: '🎨'
    },
    illustrated: {
        base: "children's book illustration style character, soft watercolor textures, gentle colors, whimsical storybook aesthetic",
        suffix: 'warm and inviting, transparent background, PNG',
        negativePrompt: 'realistic, photograph, harsh colors, scary, digital art, background',
        displayName: 'Storybook',
        emoji: '📚'
    },
    disney: {
        base: 'Disney/Pixar 3D animated style character, big sparkling eyes, smooth features, magical glow, rounded features',
        suffix: 'enchanting atmosphere, vibrant colors, transparent background, PNG',
        negativePrompt: 'realistic, photograph, scary, dark, villainous, flat, background',
        displayName: 'Disney/Pixar',
        emoji: '✨'
    }
};

// Constants for subscription limits
const TRIAL_LIMITS = {
    maxPreviews: 2,      // Trial users can preview 2 different styles
    maxCommitments: 1    // Trial users can only commit to 1 style
};

// ===========================================
// VERTEX AI HELPERS
// ===========================================

// Get access token for Vertex AI using service account
const getVertexAccessToken = async () => {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) return null;
    
    try {
        const { GoogleAuth } = require('google-auth-library');
        const credentials = JSON.parse(credentialsJson);
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        return token.token;
    } catch (err) {
        console.error('❌ Failed to get Vertex access token:', err.message);
        return null;
    }
};

// Generate a single pose image using Vertex AI Imagen
const generatePoseImage = async (selfieBase64, styleId, poseId, accessToken, projectId) => {
    const style = STYLE_BASES[styleId];
    const pose = POSE_DEFINITIONS[poseId];
    
    if (!style || !pose) {
        throw new Error(`Invalid style (${styleId}) or pose (${poseId})`);
    }

    // Combine style base with pose prompt
    const fullPrompt = `${style.base}, ${pose.prompt}, ${style.suffix}`;
    
    // Remove data URL prefix if present
    const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, '');

    console.log(`   🖌️ Generating ${poseId} pose in ${styleId} style...`);

    try {
        // Use Imagen 3 for image editing/transformation with reference
        const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: fullPrompt,
                        image: {
                            bytesBase64Encoded: base64Data
                        }
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1",
                        safetyFilterLevel: "block_some",
                        personGeneration: "allow_adult",
                        negativePrompt: style.negativePrompt
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`   ❌ Imagen API error for ${poseId}:`, errorText.slice(0, 200));
            
            // Try fallback without reference image
            return await generatePoseFromPromptOnly(fullPrompt, style.negativePrompt, accessToken, projectId);
        }

        const data = await response.json();
        
        if (!data.predictions || !data.predictions[0]) {
            console.warn(`   ⚠️ No prediction for ${poseId}, trying fallback...`);
            return await generatePoseFromPromptOnly(fullPrompt, style.negativePrompt, accessToken, projectId);
        }

        return data.predictions[0].bytesBase64Encoded;
    } catch (err) {
        console.error(`   ❌ Error generating ${poseId}:`, err.message);
        throw err;
    }
};

// Fallback: Generate pose from prompt only (without reference image)
const generatePoseFromPromptOnly = async (prompt, negativePrompt, accessToken, projectId) => {
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
                    aspectRatio: "1:1",
                    safetyFilterLevel: "block_some",
                    personGeneration: "allow_adult",
                    negativePrompt
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error('Fallback generation failed');
    }

    const data = await response.json();
    if (!data.predictions || !data.predictions[0]) {
        throw new Error('No predictions in fallback response');
    }

    return data.predictions[0].bytesBase64Encoded;
};

// Upload image to GCS
const uploadToGCS = async (imageBase64, filename) => {
    if (!bucket) {
        throw new Error('GCS bucket not configured');
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    const file = bucket.file(`characters/poses/${filename}`);
    
    await file.save(buffer, {
        metadata: {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000' // Cache for 1 year
        }
    });

    // Make the file public
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/characters/poses/${filename}`;
    return publicUrl;
};

// ===========================================
// API ENDPOINTS
// ===========================================

/**
 * GET /api/character-poses/definitions
 * Get the list of available poses with descriptions
 */
router.get('/definitions', (req, res) => {
    const poses = Object.entries(POSE_DEFINITIONS).map(([id, def]) => ({
        id,
        name: def.name,
        description: def.description
    }));

    res.json({ poses });
});

/**
 * POST /api/character-poses/generate
 * Generate all 10 poses for a child from their selfie
 * 
 * Body:
 * - selfieBase64: Base64 encoded selfie image
 * - styleId: Character style (minecraft, lego, cartoon, illustrated, disney, pixar)
 * - kidId: Child's profile ID
 * - kidName: Child's name (for logging)
 */
router.post('/generate', async (req, res) => {
    try {
        const { selfieBase64, styleId, kidId, kidName } = req.body;

        // Validation
        if (!selfieBase64) {
            return res.status(400).json({ error: 'Selfie image is required' });
        }

        if (!styleId || !STYLE_BASES[styleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_BASES) 
            });
        }

        if (!kidId) {
            return res.status(400).json({ error: 'Kid ID is required' });
        }

        console.log(`\n🎨 Starting pose generation for ${kidName || kidId} in ${styleId} style...`);
        console.log(`   📸 Generating 10 poses...`);

        // Get credentials
        const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!credentialsJson) {
            return res.status(500).json({ error: 'GCS credentials not configured' });
        }

        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        const accessToken = await getVertexAccessToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Could not get access token' });
        }

        // Generate unique hash for this session
        const sessionHash = crypto.createHash('md5')
            .update(selfieBase64.slice(0, 1000) + kidId + Date.now())
            .digest('hex')
            .slice(0, 8);

        // Generate all poses (sequentially to avoid rate limiting)
        const poseIds = Object.keys(POSE_DEFINITIONS);
        const poses = {};
        const errors = [];

        for (const poseId of poseIds) {
            try {
                // Generate the pose image
                const imageBase64 = await generatePoseImage(
                    selfieBase64, 
                    styleId, 
                    poseId, 
                    accessToken, 
                    projectId
                );

                // Upload to GCS
                const filename = `${kidId}_${styleId}_${poseId}_${sessionHash}.png`;
                const url = await uploadToGCS(imageBase64, filename);

                poses[poseId] = {
                    url,
                    name: POSE_DEFINITIONS[poseId].name,
                    description: POSE_DEFINITIONS[poseId].description
                };

                console.log(`   ✅ ${poseId} generated`);
            } catch (err) {
                console.error(`   ❌ Failed to generate ${poseId}:`, err.message);
                errors.push({ poseId, error: err.message });
            }

            // Small delay between generations to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const successCount = Object.keys(poses).length;
        console.log(`\n✅ Pose generation complete: ${successCount}/${poseIds.length} poses generated`);

        if (successCount === 0) {
            return res.status(500).json({ 
                error: 'Failed to generate any poses',
                errors 
            });
        }

        res.json({
            success: true,
            kidId,
            styleId,
            poses,
            generatedCount: successCount,
            totalPoses: poseIds.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('❌ Pose generation failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to generate poses', 
            message: err.message 
        });
    }
});

/**
 * POST /api/character-poses/generate-single
 * Generate a single pose (for regenerating specific poses)
 */
router.post('/generate-single', async (req, res) => {
    try {
        const { selfieBase64, styleId, poseId, kidId } = req.body;

        if (!selfieBase64 || !styleId || !poseId || !kidId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!STYLE_BASES[styleId]) {
            return res.status(400).json({ error: 'Invalid style' });
        }

        if (!POSE_DEFINITIONS[poseId]) {
            return res.status(400).json({ error: 'Invalid pose' });
        }

        const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!credentialsJson) {
            return res.status(500).json({ error: 'GCS credentials not configured' });
        }

        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        const accessToken = await getVertexAccessToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Could not get access token' });
        }

        console.log(`🔄 Regenerating ${poseId} pose for ${kidId}...`);

        const imageBase64 = await generatePoseImage(
            selfieBase64, 
            styleId, 
            poseId, 
            accessToken, 
            projectId
        );

        const sessionHash = crypto.createHash('md5')
            .update(selfieBase64.slice(0, 1000) + kidId + Date.now())
            .digest('hex')
            .slice(0, 8);

        const filename = `${kidId}_${styleId}_${poseId}_${sessionHash}.png`;
        const url = await uploadToGCS(imageBase64, filename);

        console.log(`✅ ${poseId} regenerated: ${url}`);

        res.json({
            success: true,
            poseId,
            url,
            name: POSE_DEFINITIONS[poseId].name,
            description: POSE_DEFINITIONS[poseId].description
        });

    } catch (err) {
        console.error('❌ Single pose generation failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to generate pose', 
            message: err.message 
        });
    }
});

/**
 * GET /api/character-poses/styles
 * Get available character styles (limited to 5)
 */
router.get('/styles', (req, res) => {
    const styles = Object.entries(STYLE_BASES).map(([id, style]) => ({
        id,
        name: style.displayName || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: style.emoji || '🎨',
        description: style.base.split(',')[0]
    }));

    res.json({ styles });
});

/**
 * POST /api/character-poses/generate-preview
 * Generate a single "standing_front" pose for style preview (~$0.02)
 * This is called when user selects a style but hasn't committed yet
 * 
 * Body:
 * - selfieBase64: Base64 encoded selfie image
 * - styleId: Character style to preview
 * - kidId: Child's profile ID
 * - previewCount: Number of previews already generated (for limit checking)
 * - isSubscribed: Whether user has an active subscription
 */
router.post('/generate-preview', async (req, res) => {
    try {
        const { selfieBase64, styleId, kidId, previewCount = 0, isSubscribed = false } = req.body;

        // Validation
        if (!selfieBase64) {
            return res.status(400).json({ error: 'Selfie image is required' });
        }

        if (!styleId || !STYLE_BASES[styleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_BASES) 
            });
        }

        if (!kidId) {
            return res.status(400).json({ error: 'Kid ID is required' });
        }

        // Check trial limits - trial users can only preview 2 styles
        if (!isSubscribed && previewCount >= TRIAL_LIMITS.maxPreviews) {
            return res.status(403).json({ 
                error: 'Preview limit reached',
                message: `Trial users can preview up to ${TRIAL_LIMITS.maxPreviews} styles. Subscribe for unlimited previews!`,
                limitReached: true
            });
        }

        console.log(`\n👀 Generating style preview for ${kidId} in ${styleId} style...`);

        // Get credentials
        const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!credentialsJson) {
            return res.status(500).json({ error: 'GCS credentials not configured' });
        }

        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        const accessToken = await getVertexAccessToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Could not get access token' });
        }

        // Generate unique hash
        const sessionHash = crypto.createHash('md5')
            .update(selfieBase64.slice(0, 1000) + kidId + Date.now())
            .digest('hex')
            .slice(0, 8);

        // Generate only the standing_front pose for preview
        const poseId = 'standing_front';
        const imageBase64 = await generatePoseImage(
            selfieBase64, 
            styleId, 
            poseId, 
            accessToken, 
            projectId
        );

        // Upload to GCS with "preview" in filename
        const filename = `${kidId}_${styleId}_preview_${sessionHash}.png`;
        const url = await uploadToGCS(imageBase64, filename);

        console.log(`✅ Preview generated for ${styleId}: ${url}`);

        res.json({
            success: true,
            kidId,
            styleId,
            previewUrl: url,
            previewsUsed: previewCount + 1,
            previewsRemaining: isSubscribed ? 'unlimited' : Math.max(0, TRIAL_LIMITS.maxPreviews - previewCount - 1)
        });

    } catch (err) {
        console.error('❌ Preview generation failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to generate preview', 
            message: err.message 
        });
    }
});

/**
 * POST /api/character-poses/commit-style
 * Commit to a style and generate all 10 poses
 * Trial users can only commit once
 * 
 * Body:
 * - selfieBase64: Base64 encoded selfie image
 * - styleId: Character style to commit to
 * - kidId: Child's profile ID
 * - kidName: Child's name (for logging)
 * - commitCount: Number of times user has committed (for limit checking)
 * - isSubscribed: Whether user has an active subscription
 * - previousPoseUrls: Array of URLs to delete from old style (optional)
 */
router.post('/commit-style', async (req, res) => {
    try {
        const { 
            selfieBase64, 
            styleId, 
            kidId, 
            kidName,
            commitCount = 0, 
            isSubscribed = false,
            previousPoseUrls = []
        } = req.body;

        // Validation
        if (!selfieBase64) {
            return res.status(400).json({ error: 'Selfie image is required' });
        }

        if (!styleId || !STYLE_BASES[styleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_BASES) 
            });
        }

        if (!kidId) {
            return res.status(400).json({ error: 'Kid ID is required' });
        }

        // Check trial limits - trial users can only commit once
        if (!isSubscribed && commitCount >= TRIAL_LIMITS.maxCommitments) {
            return res.status(403).json({ 
                error: 'Commitment limit reached',
                message: `Trial users can only create one character style. Subscribe for unlimited character recreations!`,
                limitReached: true
            });
        }

        console.log(`\n🎨 Committing to ${styleId} style for ${kidName || kidId}...`);
        console.log(`   📸 Generating all 10 poses...`);

        // Get credentials
        const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!credentialsJson) {
            return res.status(500).json({ error: 'GCS credentials not configured' });
        }

        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        const accessToken = await getVertexAccessToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Could not get access token' });
        }

        // Generate unique hash for this session
        const sessionHash = crypto.createHash('md5')
            .update(selfieBase64.slice(0, 1000) + kidId + Date.now())
            .digest('hex')
            .slice(0, 8);

        // Generate all poses (sequentially to avoid rate limiting)
        const poseIds = Object.keys(POSE_DEFINITIONS);
        const poses = {};
        const errors = [];

        for (const poseId of poseIds) {
            try {
                const imageBase64 = await generatePoseImage(
                    selfieBase64, 
                    styleId, 
                    poseId, 
                    accessToken, 
                    projectId
                );

                const filename = `${kidId}_${styleId}_${poseId}_${sessionHash}.png`;
                const url = await uploadToGCS(imageBase64, filename);

                poses[poseId] = {
                    url,
                    name: POSE_DEFINITIONS[poseId].name,
                    description: POSE_DEFINITIONS[poseId].description
                };

                console.log(`   ✅ ${poseId} generated`);
            } catch (err) {
                console.error(`   ❌ Failed to generate ${poseId}:`, err.message);
                errors.push({ poseId, error: err.message });
            }

            // Small delay between generations
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const successCount = Object.keys(poses).length;
        console.log(`\n✅ Style commitment complete: ${successCount}/${poseIds.length} poses generated`);

        if (successCount === 0) {
            return res.status(500).json({ 
                error: 'Failed to generate any poses',
                errors 
            });
        }

        // NOTE: We do NOT delete old poses here - they're saved in case user switches back
        // Cleanup is handled separately via the /cleanup endpoint

        res.json({
            success: true,
            kidId,
            styleId,
            poses,
            generatedCount: successCount,
            totalPoses: poseIds.length,
            commitmentsUsed: commitCount + 1,
            commitmentsRemaining: isSubscribed ? 'unlimited' : Math.max(0, TRIAL_LIMITS.maxCommitments - commitCount - 1),
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('❌ Style commitment failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to commit style', 
            message: err.message 
        });
    }
});

/**
 * POST /api/character-poses/cleanup
 * Delete old character pose images from GCS
 * Called when user wants to free up storage or fully replace old poses
 * 
 * Body:
 * - urls: Array of GCS URLs to delete
 * - kidId: Child's profile ID (for verification)
 */
router.post('/cleanup', async (req, res) => {
    try {
        const { urls, kidId } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        if (!kidId) {
            return res.status(400).json({ error: 'Kid ID is required for verification' });
        }

        if (!bucket) {
            return res.status(500).json({ error: 'GCS bucket not configured' });
        }

        console.log(`🗑️ Cleaning up ${urls.length} character images for ${kidId}...`);

        const deleted = [];
        const failed = [];

        for (const url of urls) {
            try {
                // Extract filename from GCS URL
                // URL format: https://storage.googleapis.com/bucket-name/characters/poses/filename.png
                const urlMatch = url.match(/characters\/poses\/([^/]+\.png)$/);
                if (!urlMatch) {
                    console.warn(`   ⚠️ Invalid URL format: ${url}`);
                    failed.push({ url, error: 'Invalid URL format' });
                    continue;
                }

                const filename = urlMatch[1];

                // Verify the file belongs to this kid (filename starts with kidId)
                if (!filename.startsWith(kidId + '_')) {
                    console.warn(`   ⚠️ File doesn't belong to kid ${kidId}: ${filename}`);
                    failed.push({ url, error: 'File does not belong to this profile' });
                    continue;
                }

                // Delete from GCS
                const file = bucket.file(`characters/poses/${filename}`);
                await file.delete();
                deleted.push(url);
                console.log(`   ✅ Deleted: ${filename}`);
            } catch (err) {
                console.error(`   ❌ Failed to delete: ${url}`, err.message);
                failed.push({ url, error: err.message });
            }
        }

        console.log(`🗑️ Cleanup complete: ${deleted.length} deleted, ${failed.length} failed`);

        res.json({
            success: true,
            deletedCount: deleted.length,
            failedCount: failed.length,
            deleted,
            failed: failed.length > 0 ? failed : undefined
        });

    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to cleanup images', 
            message: err.message 
        });
    }
});

/**
 * GET /api/character-poses/limits
 * Get current subscription limits for character creation
 */
router.get('/limits', (req, res) => {
    res.json({
        trial: {
            maxPreviews: TRIAL_LIMITS.maxPreviews,
            maxCommitments: TRIAL_LIMITS.maxCommitments,
            description: `Trial users can preview ${TRIAL_LIMITS.maxPreviews} styles and commit to ${TRIAL_LIMITS.maxCommitments}`
        },
        subscribed: {
            maxPreviews: 'unlimited',
            maxCommitments: 'unlimited',
            description: 'Subscribed users have unlimited character recreations'
        },
        styles: Object.keys(STYLE_BASES).length,
        posesPerStyle: Object.keys(POSE_DEFINITIONS).length
    });
});

module.exports = router;
