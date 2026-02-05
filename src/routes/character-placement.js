const express = require('express');
const router = express.Router();

// ===========================================
// AI CHARACTER PLACEMENT
// Uses Gemini Vision to analyze backgrounds and determine
// optimal character pose and position
// ===========================================

// Pose options that AI can choose from
const AVAILABLE_POSES = [
    { id: 'standing_front', keywords: ['neutral', 'default', 'listening', 'watching', 'observing'] },
    { id: 'standing_happy', keywords: ['happy', 'excited', 'celebrating', 'joy', 'cheerful', 'good news'] },
    { id: 'sitting', keywords: ['resting', 'relaxing', 'learning', 'lesson', 'story time', 'peaceful'] },
    { id: 'reading', keywords: ['reading', 'studying', 'book', 'bible', 'scripture', 'learning'] },
    { id: 'praying', keywords: ['praying', 'prayer', 'worship', 'thankful', 'grateful', 'reverent', 'humble'] },
    { id: 'walking', keywords: ['journey', 'traveling', 'adventure', 'walking', 'moving', 'following'] },
    { id: 'thinking', keywords: ['thinking', 'wondering', 'confused', 'curious', 'pondering', 'question'] },
    { id: 'pointing', keywords: ['showing', 'pointing', 'teaching', 'look at', 'see this', 'direction'] },
    { id: 'waving', keywords: ['greeting', 'hello', 'goodbye', 'waving', 'friendly', 'welcoming'] },
    { id: 'celebrating', keywords: ['victory', 'winning', 'celebrating', 'jumping', 'overjoyed', 'triumph'] }
];

// Get Gemini API key
const getGeminiKey = () => {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
};

/**
 * Analyze a background image using Gemini Vision
 * Returns suggested character position and pose
 */
const analyzeBackgroundWithGemini = async (imageUrl, pageText, storyContext) => {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }

    // Build the analysis prompt
    const prompt = `You are analyzing a children's storybook page image to determine where to place a cartoon character overlay.

STORY CONTEXT: ${storyContext || 'A children\'s devotional story'}
PAGE TEXT: "${pageText || 'No text on this page'}"

Analyze the image and provide:

1. SAFE PLACEMENT AREA: Find an area where a character can be placed without covering:
   - Important visual elements (faces, objects, text areas)
   - The focal point of the image
   - Any existing characters in the scene

2. RECOMMENDED POSE: Based on the story context and page text, which pose fits best?
   Available poses: standing_front, standing_happy, sitting, reading, praying, walking, thinking, pointing, waving, celebrating

3. POSITION: Provide x,y coordinates as percentages (0-100):
   - x: 0 = left edge, 100 = right edge
   - y: 0 = top edge, 100 = bottom edge
   - Characters usually look best in lower portions (y: 60-80) unless scene suggests otherwise

4. SCALE: How large should the character be? (0.5 = small, 1.0 = normal, 1.5 = large)
   - Consider perspective and available space

5. FLIP: Should the character face left (true) or right (false)?
   - Character should face toward the center of action or toward text

Respond in JSON format ONLY:
{
    "pose": "standing_front",
    "x": 75,
    "y": 70,
    "scale": 1.0,
    "flipHorizontal": false,
    "reasoning": "Brief explanation of placement choice"
}`;

    try {
        // Fetch image as base64 if it's a URL
        let imageBase64;
        let mimeType = 'image/png';
        
        if (imageUrl.startsWith('data:')) {
            // Already base64
            const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                imageBase64 = match[2];
            }
        } else {
            // Fetch from URL
            const response = await fetch(imageUrl);
            const buffer = await response.arrayBuffer();
            imageBase64 = Buffer.from(buffer).toString('base64');
            
            // Detect mime type from URL
            if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
                mimeType = 'image/jpeg';
            } else if (imageUrl.includes('.webp')) {
                mimeType = 'image/webp';
            }
        }

        // Call Gemini Vision API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType,
                                    data: imageBase64
                                }
                            },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error:', errorText);
            throw new Error('Gemini API request failed');
        }

        const data = await geminiResponse.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error('No response from Gemini');
        }

        // Parse JSON from response (handle markdown code blocks)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const placement = JSON.parse(jsonStr.trim());

        // Validate and sanitize response
        return {
            pose: AVAILABLE_POSES.find(p => p.id === placement.pose)?.id || 'standing_front',
            x: Math.max(5, Math.min(95, Number(placement.x) || 75)),
            y: Math.max(20, Math.min(90, Number(placement.y) || 70)),
            scale: Math.max(0.3, Math.min(2.0, Number(placement.scale) || 1.0)),
            flipHorizontal: Boolean(placement.flipHorizontal),
            reasoning: placement.reasoning || 'AI-determined placement'
        };

    } catch (err) {
        console.error('Gemini analysis error:', err.message);
        // Return sensible defaults on error
        return getDefaultPlacement(pageText);
    }
};

/**
 * Get default placement based on text keywords (fallback)
 */
const getDefaultPlacement = (pageText) => {
    const text = (pageText || '').toLowerCase();
    
    // Determine pose from keywords
    let pose = 'standing_front';
    for (const poseOption of AVAILABLE_POSES) {
        if (poseOption.keywords.some(kw => text.includes(kw))) {
            pose = poseOption.id;
            break;
        }
    }

    return {
        pose,
        x: 75,  // Right side by default
        y: 70,  // Lower third
        scale: 1.0,
        flipHorizontal: false,
        reasoning: 'Default placement (AI unavailable)'
    };
};

// ===========================================
// API ENDPOINTS
// ===========================================

/**
 * POST /api/character-placement/analyze
 * Analyze a single page background and get placement recommendation
 * 
 * Body:
 * - imageUrl: URL of the background image
 * - pageText: Text content on this page (for context)
 * - storyContext: Overall story description (optional)
 */
router.post('/analyze', async (req, res) => {
    try {
        const { imageUrl, pageText, storyContext } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        console.log(`🔍 Analyzing page for character placement...`);

        const placement = await analyzeBackgroundWithGemini(imageUrl, pageText, storyContext);

        console.log(`✅ Placement determined: ${placement.pose} at (${placement.x}, ${placement.y})`);

        res.json({
            success: true,
            placement
        });

    } catch (err) {
        console.error('❌ Placement analysis failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to analyze placement', 
            message: err.message,
            // Return default placement so app can still function
            placement: getDefaultPlacement(req.body?.pageText)
        });
    }
});

/**
 * POST /api/character-placement/analyze-batch
 * Analyze multiple pages at once (for a whole book)
 * 
 * Body:
 * - pages: Array of { pageNumber, imageUrl, pageText }
 * - storyContext: Overall story description
 */
router.post('/analyze-batch', async (req, res) => {
    try {
        const { pages, storyContext } = req.body;

        if (!pages || !Array.isArray(pages) || pages.length === 0) {
            return res.status(400).json({ error: 'Pages array is required' });
        }

        console.log(`🔍 Analyzing ${pages.length} pages for character placement...`);

        const results = [];

        // Process pages sequentially to avoid rate limiting
        for (const page of pages) {
            if (!page.imageUrl) {
                results.push({
                    pageNumber: page.pageNumber,
                    error: 'No image URL',
                    placement: getDefaultPlacement(page.pageText)
                });
                continue;
            }

            try {
                const placement = await analyzeBackgroundWithGemini(
                    page.imageUrl, 
                    page.pageText, 
                    storyContext
                );

                results.push({
                    pageNumber: page.pageNumber,
                    placement
                });

                console.log(`   ✅ Page ${page.pageNumber}: ${placement.pose} at (${placement.x}, ${placement.y})`);
            } catch (err) {
                console.error(`   ❌ Page ${page.pageNumber} failed:`, err.message);
                results.push({
                    pageNumber: page.pageNumber,
                    error: err.message,
                    placement: getDefaultPlacement(page.pageText)
                });
            }

            // Small delay between API calls
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`✅ Batch analysis complete: ${results.length} pages processed`);

        res.json({
            success: true,
            pageCount: results.length,
            results
        });

    } catch (err) {
        console.error('❌ Batch analysis failed:', err.message);
        res.status(500).json({ 
            error: 'Failed to analyze pages', 
            message: err.message 
        });
    }
});

/**
 * GET /api/character-placement/poses
 * Get available poses with their keywords
 */
router.get('/poses', (req, res) => {
    res.json({
        poses: AVAILABLE_POSES.map(p => ({
            id: p.id,
            keywords: p.keywords
        }))
    });
});

module.exports = router;
