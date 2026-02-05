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
const STYLE_BASES = {
    minecraft: {
        base: 'Minecraft-style blocky pixelated character, cubic voxel art, square head and body',
        suffix: 'game-ready character, transparent background, PNG',
        negativePrompt: 'realistic, smooth, round, detailed, photograph, blurry, background'
    },
    lego: {
        base: 'LEGO minifigure style character, yellow plastic skin, simple features, cylindrical head',
        suffix: 'toy-like appearance, transparent background, PNG',
        negativePrompt: 'realistic skin tone, complex features, photograph, scary, background'
    },
    cartoon: {
        base: 'cute 2D cartoon character, big expressive eyes, simplified features, animated style',
        suffix: 'clean lines, bright colors, transparent background, PNG',
        negativePrompt: 'realistic, 3D, photograph, scary, complex shading, background'
    },
    illustrated: {
        base: "children's book illustration style character, soft watercolor textures, gentle colors, whimsical storybook aesthetic",
        suffix: 'warm and inviting, transparent background, PNG',
        negativePrompt: 'realistic, photograph, harsh colors, scary, digital art, background'
    },
    disney: {
        base: 'Disney 3D animated style character, big sparkling eyes, smooth features, magical glow',
        suffix: 'enchanting atmosphere, transparent background, PNG',
        negativePrompt: 'realistic, photograph, scary, dark, villainous, background'
    },
    pixar: {
        base: 'Pixar 3D animated style character, rounded features, exaggerated expressions, stylized proportions',
        suffix: 'vibrant colors, playful energy, transparent background, PNG',
        negativePrompt: 'realistic, photograph, scary, dark, flat, background'
    }
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
 * Get available character styles
 */
router.get('/styles', (req, res) => {
    const styles = Object.entries(STYLE_BASES).map(([id, style]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: style.base.split(',')[0]
    }));

    res.json({ styles });
});

module.exports = router;
