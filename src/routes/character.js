const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { bucket } = require('../config/storage');
const { GoogleGenAI } = require('@google/genai');

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

// Generate character with Gemini 2.5 Flash Image (Nano Banana): selfie + prompt → image in one call.
// Uses GEMINI_API_KEY only; no Vertex. Returns base64 image or null.
const generateCharacterWithGemini = async (imageBase64, styleId) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    const style = STYLE_PROMPTS[styleId];
    if (!style) return null;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = (imageBase64.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';

    const contents = [
        { text: style.prompt },
        { inlineData: { mimeType, data: base64Data } }
    ];

    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents
        });
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                console.log('✅ Character generated with Gemini (Nano Banana)');
                return part.inlineData.data;
            }
        }
        return null;
    } catch (err) {
        console.warn('⚠️ Gemini image generation failed:', err.message);
        return null;
    }
};

// Generate character: try Gemini (Nano Banana) first, then fall back to Vertex Imagen (text-to-image).
const generateCharacterImage = async (imageBase64, styleId) => {
    const style = STYLE_PROMPTS[styleId];
    if (!style) {
        throw new Error(`Invalid style: ${styleId}`);
    }

    // Prefer Gemini 2.5 Flash Image: one call, selfie + style → image (like ChatGPT).
    const geminiImage = await generateCharacterWithGemini(imageBase64, styleId);
    if (geminiImage) {
        return geminiImage;
    }

    // Fallback: Vertex Imagen (text-to-image only; no selfie).
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
        throw new Error('GCS credentials not configured');
    }
    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    const accessToken = await getVertexAccessToken();
    if (!accessToken) {
        throw new Error('Could not get access token');
    }
    console.log(`🎨 Fallback: generating character in ${styleId} style with Vertex Imagen (text-to-image)...`);
    return await generateCharacterFromPromptOnly(accessToken, projectId, styleId);
};

// Text-to-image: generate character from prompt (imagen-3.0-generate-001 is text-only).
// If customPrompt is provided (from Gemini), use it; otherwise use style-only default.
const generateCharacterFromPromptOnly = async (accessToken, projectId, styleId, customPrompt = null) => {
    const styleDescriptions = {
        minecraft: "a friendly character in Minecraft blocky pixel art style, cheerful expression, colorful, game character portrait, for all ages",
        lego: "a friendly LEGO minifigure character, yellow skin, cheerful smile, toy-like appearance, studio lighting, family friendly",
        cartoon: "a friendly cartoon character with big expressive eyes, 2D animated style, bright colors, whimsical, for a storybook",
        illustrated: "a friendly character in children's book watercolor illustration style, soft colors, whimsical, storybook avatar",
        disney: "a friendly character in Disney 3D animated style, big sparkling eyes, magical, heroic, family friendly",
        pixar: "a friendly character in Pixar 3D animated style, rounded features, playful, vibrant colors, for all ages"
    };
    const prompt = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : (styleDescriptions[styleId] || styleDescriptions.illustrated);

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
                    safetyFilterLevel: "block_medium_and_above",
                    personGeneration: "allow_all"
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Imagen API error: ${errorText}`);
    }

    const data = await response.json();
    if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
        throw new Error('No predictions in Imagen response (possible safety filter)');
    }
    return data.predictions[0].bytesBase64Encoded;
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

    // With uniform bucket-level access, do not call makePublic() (per-object ACLs are disabled).
    // Ensure the bucket allows public read at bucket level if these URLs must be publicly accessible.
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
        // Return placeholder so Create Your Story flow can continue (use req.body in catch - styleId/childId are try-block scoped)
        const placeholderUrl = 'https://picsum.photos/seed/character-avatar/400/400';
        res.status(200).json({
            success: true,
            characterAvatarUrl: placeholderUrl,
            styleId: req.body?.styleId || 'illustrated',
            childId: req.body?.childId || null,
            fallback: true,
            message: 'Character generation unavailable; using placeholder. ' + (err.message || '')
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
