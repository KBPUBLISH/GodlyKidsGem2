const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { bucket } = require('../config/storage');

// Style prompts for character generation
const STYLE_PROMPTS = {
    minecraft: {
        prompt: "Transform this child's photo into a Minecraft-style character. Blocky, pixelated appearance with square head and body. Keep the child's key facial features recognizable but stylized as cubic voxel art. Friendly expression, bright colors, game-ready character portrait.",
        negativePrompt: "realistic, smooth, round, detailed, photograph, blurry"
    },
    lego: {
        prompt: "Transform this child's photo into a LEGO minifigure style character. Yellow plastic skin, simple curved smile, dot eyes, cylindrical head shape. Keep recognizable features like hair color/style. Cheerful toy-like appearance, studio lighting, clean background.",
        negativePrompt: "realistic skin tone, complex features, photograph, scary"
    },
    cartoon: {
        prompt: "Transform this child's photo into a cute 2D cartoon character. Big expressive eyes, simplified features, animated style like modern cartoons. Bright colors, clean lines, friendly expression. Keep hair color and general features recognizable.",
        negativePrompt: "realistic, 3D, photograph, scary, complex shading"
    },
    illustrated: {
        prompt: "Transform this child's photo into a children's book illustration style character. Soft watercolor textures, gentle colors, whimsical storybook aesthetic. Warm and inviting, painterly style. Keep the child's key features recognizable in an artistic way.",
        negativePrompt: "realistic, photograph, harsh colors, scary, digital art"
    },
    disney: {
        prompt: "Transform this child's photo into a Disney 3D animated style character. Big sparkling eyes, smooth features, magical glow. Keep recognizable features like hair color and style. Friendly, heroic pose, studio quality, enchanting atmosphere.",
        negativePrompt: "realistic, photograph, scary, dark, villainous"
    },
    pixar: {
        prompt: "Transform this child's photo into a Pixar 3D animated style character. Rounded features, exaggerated expressions, stylized proportions. Vibrant colors, playful energy. Keep key features recognizable. Friendly character portrait, clean studio lighting.",
        negativePrompt: "realistic, photograph, scary, dark, flat"
    }
};

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

// Generate character using Vertex AI Imagen
const generateCharacterImage = async (imageBase64, styleId) => {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    if (!credentialsJson) {
        throw new Error('GCS credentials not configured');
    }

    const style = STYLE_PROMPTS[styleId];
    if (!style) {
        throw new Error(`Invalid style: ${styleId}`);
    }

    try {
        console.log(`🎨 Generating character in ${styleId} style...`);
        
        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        
        const accessToken = await getVertexAccessToken();
        if (!accessToken) {
            throw new Error('Could not get access token');
        }

        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // Use Imagen 3 for image editing/transformation
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
                        prompt: style.prompt,
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
            console.error('❌ Imagen API error:', errorText);
            
            // Try fallback to image generation without reference
            console.log('🔄 Trying text-to-image generation as fallback...');
            return await generateCharacterFromPromptOnly(accessToken, projectId, styleId);
        }

        const data = await response.json();
        
        if (!data.predictions || !data.predictions[0]) {
            console.error('❌ No predictions in response:', data);
            return await generateCharacterFromPromptOnly(accessToken, projectId, styleId);
        }

        const generatedImage = data.predictions[0].bytesBase64Encoded;
        return generatedImage;

    } catch (err) {
        console.error('❌ Character generation error:', err.message);
        throw err;
    }
};

// Fallback: Generate character from prompt only (without reference image)
const generateCharacterFromPromptOnly = async (accessToken, projectId, styleId) => {
    const styleDescriptions = {
        minecraft: "a cute child character in Minecraft blocky pixel art style, friendly expression, colorful, game character portrait",
        lego: "a cute child LEGO minifigure character, yellow skin, cheerful smile, toy-like appearance, studio lighting",
        cartoon: "a cute child cartoon character with big expressive eyes, 2D animated style, bright colors, friendly",
        illustrated: "a cute child character in children's book watercolor illustration style, soft colors, whimsical",
        disney: "a cute child character in Disney 3D animated style, big sparkling eyes, magical, heroic",
        pixar: "a cute child character in Pixar 3D animated style, rounded features, playful, vibrant colors"
    };

    const prompt = styleDescriptions[styleId] || styleDescriptions.cartoon;

    try {
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
                        personGeneration: "allow_adult"
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Imagen fallback failed: ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.predictions || !data.predictions[0]) {
            throw new Error('No predictions in fallback response');
        }

        return data.predictions[0].bytesBase64Encoded;
    } catch (err) {
        console.error('❌ Fallback generation error:', err.message);
        throw err;
    }
};

// Upload image to GCS
const uploadToGCS = async (imageBase64, filename) => {
    if (!bucket) {
        throw new Error('GCS bucket not configured');
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    const file = bucket.file(`characters/${filename}`);
    
    await file.save(buffer, {
        metadata: {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000'
        }
    });

    // Make the file public
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/characters/${filename}`;
    return publicUrl;
};

// POST /api/character/generate
// Generate a character avatar from a selfie
router.post('/generate', async (req, res) => {
    try {
        const { imageBase64, styleId, childId, childName } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image is required' });
        }

        if (!styleId || !STYLE_PROMPTS[styleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_PROMPTS) 
            });
        }

        console.log(`🎨 Generating ${styleId} character for ${childName || 'child'}...`);

        // Generate the character image
        const generatedImageBase64 = await generateCharacterImage(imageBase64, styleId);

        // Create unique filename
        const hash = crypto.createHash('md5').update(imageBase64.slice(0, 1000) + styleId + Date.now()).digest('hex').slice(0, 12);
        const filename = `character_${childId || 'unknown'}_${styleId}_${hash}.png`;

        // Upload to GCS
        const imageUrl = await uploadToGCS(generatedImageBase64, filename);

        console.log(`✅ Character generated: ${imageUrl}`);

        res.json({
            success: true,
            characterAvatarUrl: imageUrl,
            styleId,
            childId
        });

    } catch (err) {
        console.error('❌ Character generation failed:', err.message);
        // Return placeholder so Create Your Story flow can continue
        const placeholderUrl = 'https://picsum.photos/seed/character-avatar/400/400';
        res.status(200).json({
            success: true,
            characterAvatarUrl: placeholderUrl,
            styleId: styleId,
            childId: childId || null,
            fallback: true,
            message: 'Character generation unavailable; using placeholder. ' + err.message
        });
    }
});

// GET /api/character/styles
// Get available character styles
router.get('/styles', (req, res) => {
    const styles = Object.keys(STYLE_PROMPTS).map(id => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: STYLE_PROMPTS[id].prompt.split('.')[0] + '.'
    }));

    res.json({ styles });
});

// POST /api/character/regenerate
// Regenerate character with same selfie but different style
router.post('/regenerate', async (req, res) => {
    try {
        const { originalSelfie, newStyleId, childId, childName } = req.body;

        if (!originalSelfie) {
            return res.status(400).json({ error: 'Original selfie is required' });
        }

        if (!newStyleId || !STYLE_PROMPTS[newStyleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_PROMPTS) 
            });
        }

        console.log(`🔄 Regenerating character in ${newStyleId} style for ${childName || 'child'}...`);

        // Generate new character
        const generatedImageBase64 = await generateCharacterImage(originalSelfie, newStyleId);

        // Create unique filename
        const hash = crypto.createHash('md5').update(originalSelfie.slice(0, 1000) + newStyleId + Date.now()).digest('hex').slice(0, 12);
        const filename = `character_${childId || 'unknown'}_${newStyleId}_${hash}.png`;

        // Upload to GCS
        const imageUrl = await uploadToGCS(generatedImageBase64, filename);

        console.log(`✅ Character regenerated: ${imageUrl}`);

        res.json({
            success: true,
            characterAvatarUrl: imageUrl,
            styleId: newStyleId,
            childId
        });

    } catch (err) {
        console.error('❌ Character regeneration failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to regenerate character', 
            message: err.message 
        });
    }
});

module.exports = router;
