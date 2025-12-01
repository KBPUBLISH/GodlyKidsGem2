const axios = require('axios');

/**
 * Generate activity (quiz or reflection) from devotional content using AI
 * @param {string} devotionalContent - Devotional content text
 * @param {string} activityType - 'quiz' or 'reflection'
 * @returns {Promise<Object>} Generated activity object
 */
async function generateActivityFromDevotional(devotionalContent, activityType = 'quiz') {
    try {
        // Check which AI service to use (OpenAI or Gemini)
        const aiProvider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'gemini'
        
        if (aiProvider === 'openai') {
            return await generateWithOpenAI(devotionalContent, activityType);
        } else if (aiProvider === 'gemini') {
            return await generateWithGemini(devotionalContent, activityType);
        } else {
            throw new Error(`Unsupported AI provider: ${aiProvider}`);
        }
    } catch (error) {
        console.error('Error generating activity with AI:', error);
        throw error;
    }
}

/**
 * Generate activity using OpenAI
 */
async function generateWithOpenAI(devotionalContent, activityType) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    if (!devotionalContent || !devotionalContent.trim()) {
        throw new Error('Devotional content is required to generate activity');
    }

    // Build the prompt based on activity type
    let systemPrompt, userPrompt;
    
    if (activityType === 'quiz') {
        systemPrompt = `You are an educational content creator for children's Christian lessons. Generate engaging quiz questions based on devotional content. Questions should be age-appropriate, clear, and help reinforce key learning points.`;
        userPrompt = `Based on the following devotional content, generate 5 quiz questions. Each question should have 4 multiple-choice options with only one correct answer. Make them engaging and educational for children.

Devotional Content: ${devotionalContent}

Please respond with a JSON object in this exact format:
{
    "title": "Quiz Title",
    "questions": [
        {
            "question": "Question 1 text",
            "options": [
                {"text": "Option 1", "isCorrect": true},
                {"text": "Option 2", "isCorrect": false},
                {"text": "Option 3", "isCorrect": false},
                {"text": "Option 4", "isCorrect": false}
            ]
        },
        {
            "question": "Question 2 text",
            "options": [
                {"text": "Option 1", "isCorrect": false},
                {"text": "Option 2", "isCorrect": true},
                {"text": "Option 3", "isCorrect": false},
                {"text": "Option 4", "isCorrect": false}
            ]
        }
        // ... continue for all 5 questions
    ]
}`;
    } else {
        systemPrompt = `You are an educational content creator for children's Christian lessons. Generate thoughtful reflection prompts that help children internalize and apply what they learned from devotional content.`;
        userPrompt = `Based on the following devotional content, generate a reflection prompt that encourages children to think about and apply what they learned.

Devotional Content: ${devotionalContent}

Please respond with a JSON object in this exact format:
{
    "title": "Reflection Title",
    "prompt": "The reflection prompt text that encourages thoughtful consideration"
}`;
    }

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const content = response.data.choices[0].message.content;
    let parsedContent;
    
    try {
        parsedContent = JSON.parse(content);
    } catch (parseError) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
            parsedContent = JSON.parse(jsonMatch[1]);
        } else {
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    // Format the response based on activity type
    if (activityType === 'quiz') {
        // Support both old format (single question) and new format (multiple questions)
        if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
            return {
                type: 'quiz',
                title: parsedContent.title || 'Quiz',
                questions: parsedContent.questions
            };
        } else {
            // Legacy format - convert single question to questions array
            return {
                type: 'quiz',
                title: parsedContent.title || 'Quiz',
                questions: [{
                    question: parsedContent.question || parsedContent.content || '',
                    options: parsedContent.options || []
                }]
            };
        }
    } else {
        return {
            type: 'reflection',
            title: parsedContent.title || 'Reflection',
            content: parsedContent.prompt || parsedContent.content || ''
        };
    }
}

/**
 * Generate activity using Google Gemini
 */
async function generateWithGemini(devotionalContent, activityType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    if (!devotionalContent || !devotionalContent.trim()) {
        throw new Error('Devotional content is required to generate activity');
    }

    // Build the prompt
    let prompt;
    
    if (activityType === 'quiz') {
        prompt = `You are an educational content creator for children's Christian lessons. Based on the following devotional content, generate 5 quiz questions. Each question should have 4 multiple-choice options with only one correct answer. Make them engaging and educational for children.

Devotional Content: ${devotionalContent}

Respond with a JSON object in this exact format:
{
    "title": "Quiz Title",
    "questions": [
        {
            "question": "Question 1 text",
            "options": [
                {"text": "Option 1", "isCorrect": true},
                {"text": "Option 2", "isCorrect": false},
                {"text": "Option 3", "isCorrect": false},
                {"text": "Option 4", "isCorrect": false}
            ]
        },
        {
            "question": "Question 2 text",
            "options": [
                {"text": "Option 1", "isCorrect": false},
                {"text": "Option 2", "isCorrect": true},
                {"text": "Option 3", "isCorrect": false},
                {"text": "Option 4", "isCorrect": false}
            ]
        }
        // ... continue for all 5 questions
    ]
}`;
    } else {
        prompt = `You are an educational content creator for children's Christian lessons. Based on the following devotional content, generate a reflection prompt that encourages children to think about and apply what they learned.

Devotional Content: ${devotionalContent}

Respond with a JSON object in this exact format:
{
    "title": "Reflection Title",
    "prompt": "The reflection prompt text that encourages thoughtful consideration"
}`;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await axios.post(
        url,
        {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
                responseMimeType: 'application/json'
            }
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    let parsedContent;
    
    try {
        parsedContent = JSON.parse(content);
    } catch (parseError) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
            parsedContent = JSON.parse(jsonMatch[1]);
        } else {
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    // Format the response based on activity type
    if (activityType === 'quiz') {
        // Support both old format (single question) and new format (multiple questions)
        if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
            return {
                type: 'quiz',
                title: parsedContent.title || 'Quiz',
                questions: parsedContent.questions
            };
        } else {
            // Legacy format - convert single question to questions array
            return {
                type: 'quiz',
                title: parsedContent.title || 'Quiz',
                questions: [{
                    question: parsedContent.question || parsedContent.content || '',
                    options: parsedContent.options || []
                }]
            };
        }
    } else {
        return {
            type: 'reflection',
            title: parsedContent.title || 'Reflection',
            content: parsedContent.prompt || parsedContent.content || ''
        };
    }
}

module.exports = {
    generateActivityFromDevotional
};

