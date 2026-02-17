const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { bucket } = require('../config/storage');
const { GoogleGenAI } = require('@google/genai');

// Settings: where we place the character (full body in scene, default ship deck)
const SETTINGS = {
    shipDeck: 'the wooden deck of a sailing ship with ropes, mast, and ocean or sky in the background—adventure style',
    forest: 'a sun-dappled enchanted forest with tall trees, soft moss, and gentle light filtering through leaves',
    meadow: 'a peaceful flower meadow with butterflies and blue sky',
    kingdom: 'a friendly fantasy kingdom with a castle in the background and cobblestone path'
};

const DEFAULT_SETTING = 'shipDeck';

// Critical: preserve what the person is wearing so the avatar matches their real outfit. Preserve hats/accessories if present; do not add if absent.
const CLOTHING_PRESERVATION = " CRITICAL — clothing and accessories: (1) If the reference photo shows the person wearing a hat, cap, headwear, glasses, or headphones, you MUST depict them wearing that same item—do not omit it. (2) Depict ONLY the clothing and accessories visible in the reference photo; do not add hats, caps, headphones, or glasses if they are not in the photo. Keep the exact same outfit as in the photo. Do not replace with costumes, tunics, or fantasy outfits. Only the art style should change; the person's outfit and any headwear/accessories must match the photo.";

// Critical: preserve age, facial features. Do NOT turn adults into children.
const AGE_AND_APPEARANCE_PRESERVATION = " CRITICAL — age and appearance: If the photo shows an ADULT (e.g. with beard, adult facial structure, or adult features), you MUST depict an ADULT—do NOT turn them into a child or kid. Preserve exact eye color from the photo (e.g. brown eyes stay brown, not blue). Preserve hair color and details (e.g. streaks, gray, style). Preserve beard, mustache, or facial hair if present.";

// Framing: full-body character so the person looks complete (not cropped at waist). Slightly close framing so the figure fills the frame.
const FULL_BODY_FRAMING = " Frame as a full-body character: show the complete person from head to toe (or head to mid-calf at minimum) so they look like a whole person standing in the scene. Do NOT crop at the waist or show only a floating torso—the person must have a complete body with legs visible. Slightly close framing so the figure fills the frame nicely, centered, standing naturally.";

// Style prompts: full-body character in a setting. Selfie is reference for face, identity, age, clothing, and accessories (including hat/headwear if worn).
// {{SETTING}} is replaced with SETTINGS[settingId] (e.g. shipDeck, forest, meadow).
const STYLE_PROMPTS = {
    pixar: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear visible in the photo), generate one image: the person as a character in Pixar 3D animated style, full body in {{SETTING}}. Preserve any hat or headwear from the photo. If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve exact eye color, hair (including streaks), and facial hair from the photo. Rounded features, vibrant colors, playful energy. Depict only the clothing and accessories visible in the photo; do not add any that are not in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, photograph, scary, dark, flat, cropped at waist, floating torso, head only, turning adult into child"
    },
    minecraft: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a Minecraft-style blocky character, full body in {{SETTING}}. If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve eye color, hair (including streaks), and beard in blocky form. Keep outfit recognizable but blocky—only what is in the photo; do not add hat or headphones unless in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, smooth, round, detailed photograph, blurry, cropped at waist, floating torso"
    },
    disney: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a character in Disney 2D animated style, full body in {{SETTING}}. Use classic Disney 2D animation—flat or cel-shaded, hand-drawn look, NOT 3D (distinct from Pixar). If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve exact eye color, hair (including streaks), and facial hair. Big expressive eyes, smooth lines, vibrant colors. Keep face and outfit the same as in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, photograph, 3D render, Pixar style, scary, dark, villainous, cropped at waist, floating torso, turning adult into child"
    },
    anime: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a character in Disney 2D animated style, full body in {{SETTING}}. Use classic Disney 2D animation—flat or cel-shaded, hand-drawn look, NOT 3D (distinct from Pixar). If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve exact eye color, hair (including streaks), and facial hair. Big expressive eyes, smooth lines, vibrant colors. Keep face and outfit the same as in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, photograph, 3D render, Pixar style, scary, dark, villainous, cropped at waist, floating torso, turning adult into child"
    },
    lego: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a LEGO minifigure style character, full body in {{SETTING}}. If the photo shows an adult (e.g. with beard), depict an adult minifigure—do not turn them into a child. Preserve hair color and style (e.g. streaks) and suggest beard if present. Keep outfit recognizable in LEGO style—only what is in the photo; do not add hat or headphones unless in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic skin tone, complex features, photograph, scary, cropped minifigure"
    },
    cartoon: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a cute 2D cartoon character, full body in {{SETTING}}. If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve exact eye color, hair (including streaks), and facial hair. Big expressive eyes, simplified features, bright colors. Depict only the clothing and accessories visible in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, 3D, photograph, scary, cropped at waist, floating torso, turning adult into child"
    },
    illustrated: {
        prompt: "Using this photo as the only reference for this person's face, identity, age, clothing, and accessories (including any hat or headwear in the photo), generate one image: the person as a character in children's book illustration style, full body in {{SETTING}}. If the photo shows an adult (e.g. with beard), depict an adult—do not turn them into a child. Preserve exact eye color, hair (including streaks), and facial hair. Soft watercolor textures, gentle colors, whimsical. Depict only the clothing and accessories visible in the photo." + AGE_AND_APPEARANCE_PRESERVATION + CLOTHING_PRESERVATION + FULL_BODY_FRAMING,
        negativePrompt: "realistic, photograph, harsh colors, scary, cropped at waist, floating torso, turning adult into child"
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

// Generate character: try Vertex Gemini (selfie + prompt) first, then consumer Gemini, then Vertex Imagen (text-only fallback).
// settingId: optional, one of SETTINGS keys (default shipDeck) — used to replace {{SETTING}} in the prompt.
const generateCharacterImage = async (imageBase64, styleId, settingId = null) => {
    const style = STYLE_PROMPTS[styleId];
    if (!style) {
        throw new Error(`Invalid style: ${styleId}`);
    }

    const setting = SETTINGS[settingId] || SETTINGS[DEFAULT_SETTING];
    const resolvedPrompt = style.prompt.replace(/\{\{SETTING\}\}/g, setting);

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

    // 1) Vertex AI Gemini 2.5 Flash Image — same model as Nano Banana, but via your GCP project so the selfie is used and region block is avoided.
    if (accessToken && projectId) {
        const vertexImage = await generateCharacterWithVertexGemini(imageBase64, styleId, accessToken, projectId, resolvedPrompt);
        if (vertexImage) return vertexImage;
    }

    // 2) Consumer Gemini (in case backend runs in a region where it works).
    const consumerImage = await generateCharacterWithConsumerGemini(imageBase64, styleId, resolvedPrompt);
    if (consumerImage) return consumerImage;

    // 3) Fallback: Vertex Imagen text-to-image only (no selfie — generic character).
    if (!hasVertex || !accessToken || !projectId) {
        throw new Error('GCS credentials not configured');
    }
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
        disney: "a friendly character in Disney 2D animated style, flat or cel-shaded, not 3D—classic hand-drawn animation look, big expressive eyes, family friendly",
        anime: "a friendly character in Disney 2D animated style, flat or cel-shaded, not 3D—classic hand-drawn animation look, big expressive eyes, family friendly",
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
// Generate a full-body character from a selfie, in the chosen style, placed in a setting (e.g. ship deck).
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
