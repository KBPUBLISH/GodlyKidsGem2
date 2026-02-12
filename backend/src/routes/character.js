const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { bucket } = require('../config/storage');
const { GoogleGenAI } = require('@google/genai');

// Settings: where we place the full-body character (default forest)
const SETTINGS = {
    forest: 'a sun-dappled enchanted forest with tall trees, soft moss, and gentle light filtering through leaves',
    meadow: 'a peaceful flower meadow with butterflies and blue sky',
    kingdom: 'a friendly fantasy kingdom with a castle in the background and cobblestone path'
};

const DEFAULT_SETTING = 'forest';

// Style prompts: full-body character in a setting (not just a portrait). Selfie is reference for face/identity.
// {{SETTING}} is replaced with SETTINGS[settingId]. We explicitly require background replacement and full style transform (no keeping the original room/photo look).
const STYLE_PROMPTS = {
    pixar: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body character in Pixar 3D animated style, standing or walking in {{SETTING}}. Replace the entire background with {{SETTING}}; do not keep the original room or indoor setting. Fully transform the image into Pixar 3D animation style—smooth, stylized, not photorealistic. Rounded features, vibrant colors, playful energy. The child must be full body (head to feet visible). Keep the child's face recognizable from the photo; body and environment in Pixar style.",
        negativePrompt: "realistic, photograph, scary, dark, flat, portrait only, close-up face only"
    },
    minecraft: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body Minecraft-style blocky character, standing in {{SETTING}}. Replace the entire background with {{SETTING}}; do not keep the original room or setting. Square head and body, voxel style. The child must be full body (head to feet visible). Keep facial features recognizable but blocky; friendly, bright colors.",
        negativePrompt: "realistic, smooth, round, detailed photograph, blurry, portrait only, close-up only"
    },
    disney: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body character in Disney 3D animated style, standing or walking in {{SETTING}}. Replace the entire background with {{SETTING}}—the scene must be only the forest (or chosen setting); do not keep the original room, desk, TV, or indoor background. Fully transform into Disney 3D animated style: smooth stylized features, big sparkling eyes, magical glow, like a Disney movie character—not a photograph or realistic image. The child must be full body (head to feet visible). Keep face recognizable; enchanting, family-friendly atmosphere.",
        negativePrompt: "realistic, photograph, scary, dark, villainous, portrait only, close-up only"
    },
    lego: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body LEGO minifigure style character, standing in {{SETTING}}. Replace the entire background with {{SETTING}}; do not keep the original room or indoor setting. Yellow plastic skin, simple features. Full body visible in the scene. Keep hair color/style recognizable.",
        negativePrompt: "realistic skin tone, complex features, photograph, scary, portrait only"
    },
    cartoon: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body cute 2D cartoon character, standing in {{SETTING}}. Replace the entire background with {{SETTING}}; do not keep the original room or setting. Big expressive eyes, simplified features, bright colors. Full body (head to feet) in the scene.",
        negativePrompt: "realistic, 3D, photograph, scary, portrait only, close-up only"
    },
    illustrated: {
        prompt: "Using this photo as the only reference for this child's face and identity, generate one image: the child as a full-body character in children's book illustration style, standing in {{SETTING}}. Replace the entire background with {{SETTING}}; do not keep the original room or setting. Soft watercolor textures, gentle colors, whimsical. Full body visible in the scene.",
        negativePrompt: "realistic, photograph, harsh colors, scary, portrait only, close-up only"
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

// Vertex AI Gemini 2.5 Flash Image: selfie + prompt → image. Uses your GCP project (no consumer API region block).
// resolvedPrompt: if provided, use instead of style.prompt (e.g. with {{SETTING}} already replaced).
const generateCharacterWithVertexGemini = async (imageBase64, styleId, accessToken, projectId, resolvedPrompt = null) => {
    const style = STYLE_PROMPTS[styleId];
    if (!style) return null;
    const promptText = resolvedPrompt != null ? resolvedPrompt : style.prompt;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = (imageBase64.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`;
    const body = {
        contents: [{
            role: 'user',
            parts: [
                { text: promptText },
                { inlineData: { mimeType, data: base64Data } }
            ]
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '1:1' }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errText = await response.text();
            console.warn('⚠️ Vertex Gemini image generation failed:', response.status, errText.slice(0, 200));
            return null;
        }
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                console.log('✅ Character generated with Vertex AI Gemini 2.5 Flash Image (selfie + style)');
                return part.inlineData.data;
            }
        }
        return null;
    } catch (err) {
        console.warn('⚠️ Vertex Gemini request error:', err?.message);
        return null;
    }
};

// Consumer Gemini API (Nano Banana): selfie + prompt → image. Often blocked by "location not supported" when using image input from Render.
// resolvedPrompt: if provided, use instead of style.prompt.
const generateCharacterWithConsumerGemini = async (imageBase64, styleId, resolvedPrompt = null) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    const style = STYLE_PROMPTS[styleId];
    if (!style) return null;
    const promptText = resolvedPrompt != null ? resolvedPrompt : style.prompt;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = (imageBase64.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';

    const contents = [
        { text: promptText },
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
                console.log('✅ Character generated with consumer Gemini (Nano Banana)');
                return part.inlineData.data;
            }
        }
        return null;
    } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('location is not supported') || msg.includes('FAILED_PRECONDITION')) {
            console.log('ℹ️ Consumer Gemini unavailable (region); Vertex/Imagen used instead.');
        } else {
            console.warn('⚠️ Consumer Gemini image generation failed:', msg);
        }
        return null;
    }
};

// Vertex Imagen with selfie as subject reference (imagen-3.0-capability-001). Fallback when Gemini fails. Output is used as childCharacterImageUrl in books.
const generateCharacterWithVertexImagenSelfie = async (imageBase64, styleId, accessToken, projectId, resolvedPrompt, setting = null) => {
    const styleDescriptions = {
        minecraft: 'Minecraft blocky pixel art character, full body',
        lego: 'LEGO minifigure style character, full body',
        cartoon: '2D cartoon character with big eyes, full body',
        illustrated: 'children\'s book watercolor illustration character, full body',
        disney: 'Disney 3D animated character, full body, big sparkling eyes',
        pixar: 'Pixar 3D animated character, full body, rounded features'
    };
    const styleDesc = styleDescriptions[styleId] || styleDescriptions.illustrated;
    const scene = setting || SETTINGS[DEFAULT_SETTING];
    // Same person + explicit background: scene must be the described setting, not the reference photo's room/indoor background. Only include accessories (e.g. glasses) if visible in the reference; do not add them otherwise.
    const prompt = `The child in the reference photo [1], and only that child, as a ${styleDesc}, standing in ${scene}. The background must be only this scene (e.g. forest), not the reference photo's room or indoor setting. Keep the child's face and identity exactly from the reference. Only include glasses or other accessories if they are clearly visible in the reference photo; do not add glasses, headphones, or any accessory that is not in the photo. Fully stylized (e.g. Disney/Pixar look), not photorealistic. Full body from head to feet. Family-friendly.`;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    try {
        const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-capability-001:predict`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    instances: [{
                        prompt,
                        referenceImages: [{
                            referenceId: 1,
                            referenceImage: { bytesBase64Encoded: cleanBase64 },
                            referenceType: 'REFERENCE_TYPE_SUBJECT',
                            subjectImageConfig: {
                                subjectDescription: 'The child in this photo. Output must be the same person with the same face, only styled as the requested character.',
                                subjectType: 'SUBJECT_TYPE_PERSON'
                            }
                        }]
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: '1:1',
                        safetyFilterLevel: 'block_medium_and_above',
                        personGeneration: 'allow_all'
                    }
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.warn('⚠️ Vertex Imagen (selfie ref) failed:', response.status, errText.slice(0, 200));
            return null;
        }

        const data = await response.json();
        if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
            console.warn('⚠️ Vertex Imagen (selfie ref) returned no image (possible safety filter)');
            return null;
        }
        console.log('✅ Character generated with Vertex Imagen (selfie as reference)');
        return data.predictions[0].bytesBase64Encoded;
    } catch (err) {
        console.warn('⚠️ Vertex Imagen (selfie ref) error:', err?.message);
        return null;
    }
};

// Generate character: try Gemini first (best face preservation; this URL becomes childCharacterImageUrl for the book), then Imagen with selfie, then text-only.
// settingId: optional, one of SETTINGS keys (default forest) — used to replace {{SETTING}} in the prompt for full-body-in-scene.
const generateCharacterImage = async (imageBase64, styleId, settingId = null) => {
    const style = STYLE_PROMPTS[styleId];
    if (!style) {
        throw new Error(`Invalid style: ${styleId}`);
    }

    const setting = SETTINGS[settingId] || SETTINGS[DEFAULT_SETTING];
    const resolvedPrompt = style.prompt.replace(/\{\{SETTING\}\}/g, setting) +
        ' Only include accessories (e.g. glasses) that are clearly visible in the reference photo; do not add glasses or other accessories that are not in the photo.';

    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const hasVertex = !!credentialsJson;
    let accessToken = null;
    let projectId = null;
    if (hasVertex) {
        try {
            const credentials = JSON.parse(credentialsJson);
            projectId = credentials.project_id;
            accessToken = await getVertexAccessToken();
        } catch (_) {}
    }

    if (!hasVertex || !accessToken || !projectId) {
        // No Vertex: try Consumer Gemini only, then fail (no text-only without GCP).
        const consumerImage = await generateCharacterWithConsumerGemini(imageBase64, styleId, resolvedPrompt);
        if (consumerImage) return consumerImage;
        throw new Error('GCS credentials not configured');
    }

    // 1) Vertex AI Gemini 2.5 Flash Image — best at preserving the face from the photo; this image becomes the book's child reference.
    const vertexImage = await generateCharacterWithVertexGemini(imageBase64, styleId, accessToken, projectId, resolvedPrompt);
    if (vertexImage) return vertexImage;

    // 2) Consumer Gemini (when backend runs in a region where it works).
    const consumerImage = await generateCharacterWithConsumerGemini(imageBase64, styleId, resolvedPrompt);
    if (consumerImage) return consumerImage;

    // 3) Vertex Imagen with selfie as subject (fallback when Gemini unavailable).
    const imagenWithSelfie = await generateCharacterWithVertexImagenSelfie(imageBase64, styleId, accessToken, projectId, resolvedPrompt, setting);
    if (imagenWithSelfie) return imagenWithSelfie;

    // 4) Last fallback: Vertex Imagen text-to-image only (no selfie — generic character).
    console.log(`🎨 Fallback: generating character in ${styleId} style with Vertex Imagen (text-to-image; no selfie)...`);
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
// Generate a full-body character from a selfie, in the chosen style, placed in a setting (e.g. forest).
router.post('/generate', async (req, res) => {
    try {
        const { imageBase64, styleId, childId, childName, settingId } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image is required' });
        }

        if (!styleId || !STYLE_PROMPTS[styleId]) {
            return res.status(400).json({ 
                error: 'Invalid style', 
                validStyles: Object.keys(STYLE_PROMPTS) 
            });
        }

        const setting = settingId && SETTINGS[settingId] ? settingId : DEFAULT_SETTING;
        console.log(`🎨 Generating full-body ${styleId} character in ${setting} for ${childName || 'child'}...`);

        // Generate the character image (full body in setting)
        const generatedImageBase64 = await generateCharacterImage(imageBase64, styleId, setting);

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
