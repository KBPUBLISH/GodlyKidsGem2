const express = require('express');
const router = express.Router();
const axios = require('axios');
const BookQuiz = require('../models/BookQuiz');
const Book = require('../models/Book');
const Page = require('../models/Page');

// Helper function to get age-appropriate prompt
const getAgeAppropriatePrompt = (age, ageGroup) => {
    switch (ageGroup) {
        case '3-5':
            return `You are creating a quiz for a child aged 3-5 years old.
Rules for this age group:
- Use VERY simple words (1-2 syllables when possible)
- Questions should be about basic things: colors, animals, characters, simple actions
- Options should be short (2-4 words maximum)
- Make questions fun and encouraging
- Focus on "what" and "who" questions, not "why" or "how"
- Include picture-friendly concepts (things kids can visualize)
- Example: "What color was the bunny?" with options like "White", "Blue", "Green", "Red"`;

        case '6-8':
            return `You are creating a quiz for a child aged 6-8 years old.
Rules for this age group:
- Use simple but slightly more complex vocabulary
- Questions can include basic comprehension and sequence of events
- Options can be short sentences (5-8 words)
- Include some "why" questions with simple reasoning
- Test memory of story details and character names
- Example: "Why did the farmer go to the field?" with options about the story`;

        case '9-12':
            return `You are creating a quiz for a child aged 9-12 years old.
Rules for this age group:
- Use grade-appropriate vocabulary
- Questions should test deeper comprehension and themes
- Include inference questions (what might happen next, why characters acted a certain way)
- Options can be full sentences
- Include questions about lessons learned and moral of the story
- Test understanding of cause and effect
- Example: "What lesson did the main character learn about friendship?"`;

        default:
            return `You are creating a quiz for a child. Use age-appropriate language and concepts.`;
    }
};

// Helper to robustly extract JSON from AI response
const extractJson = (text) => {
    if (!text) return null;
    
    let content = text.trim();
    
    // 1. Try parsing directly first
    try {
        return JSON.parse(content);
    } catch (e) {}

    // 2. Try removing markdown code blocks (```json ... ```)
    const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        try {
            return JSON.parse(markdownMatch[1]);
        } catch (e) {}
        content = markdownMatch[1]; // Use inner content for next attempts
    }

    // 3. Find the first JSON object or array structure
    const firstBracket = content.indexOf('[');
    const firstBrace = content.indexOf('{');
    
    let startIndex = -1;
    // Determine which starts first
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        startIndex = firstBracket;
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
    }
    
    if (startIndex !== -1) {
        const isArray = content[startIndex] === '[';
        const lastIndex = content.lastIndexOf(isArray ? ']' : '}');
        
        if (lastIndex > startIndex) {
            const potentialJson = content.substring(startIndex, lastIndex + 1);
            try {
                return JSON.parse(potentialJson);
            } catch (e) {
                // 4. Try basic cleanup (trailing commas)
                try {
                    // Regex to remove trailing commas before closing braces/brackets
                    const cleanJson = potentialJson.replace(/,\s*([\]}])/g, '$1');
                    return JSON.parse(cleanJson);
                } catch (e2) {}
            }
        }
    }

    throw new Error('Could not parse JSON from AI response');
};

// Fallback questions to use when AI service is unavailable or quota exceeded
const FALLBACK_QUESTIONS_ATTEMPT1 = [
    {
        question: "Did you enjoy reading this story?",
        options: [
            { text: "Yes, I loved it!", isCorrect: true },
            { text: "It was okay", isCorrect: false },
            { text: "Not really", isCorrect: false },
            { text: "I want to read it again", isCorrect: true }
        ]
    },
    {
        question: "What was the best part of the story?",
        options: [
            { text: "The beginning", isCorrect: false },
            { text: "The middle", isCorrect: false },
            { text: "The ending", isCorrect: true },
            { text: "All of it!", isCorrect: true }
        ]
    },
    {
        question: "Who was the most important character?",
        options: [
            { text: "The main character", isCorrect: true },
            { text: "The villain", isCorrect: false },
            { text: "A random person", isCorrect: false },
            { text: "Nobody", isCorrect: false }
        ]
    },
    {
        question: "What lesson did this story teach?",
        options: [
            { text: "To be kind and good", isCorrect: true },
            { text: "To be mean", isCorrect: false },
            { text: "Nothing at all", isCorrect: false },
            { text: "To run away", isCorrect: false }
        ]
    },
    {
        question: "How did the story make you feel?",
        options: [
            { text: "Happy", isCorrect: true },
            { text: "Sad", isCorrect: false },
            { text: "Angry", isCorrect: false },
            { text: "Scared", isCorrect: false }
        ]
    },
    {
        question: "Would you recommend this story to a friend?",
        options: [
            { text: "Yes, definitely!", isCorrect: true },
            { text: "Maybe", isCorrect: false },
            { text: "No way", isCorrect: false },
            { text: "Only if they like reading", isCorrect: true }
        ]
    }
];

// Different fallback questions for attempt 2
const FALLBACK_QUESTIONS_ATTEMPT2 = [
    {
        question: "What did you learn from this story?",
        options: [
            { text: "To always be helpful", isCorrect: true },
            { text: "To stay home", isCorrect: false },
            { text: "Nothing new", isCorrect: false },
            { text: "To trust God", isCorrect: true }
        ]
    },
    {
        question: "What would you do differently than the main character?",
        options: [
            { text: "Ask for help sooner", isCorrect: true },
            { text: "Do the same thing", isCorrect: false },
            { text: "Run away", isCorrect: false },
            { text: "Give up", isCorrect: false }
        ]
    },
    {
        question: "Which part of the story surprised you?",
        options: [
            { text: "The ending", isCorrect: true },
            { text: "Nothing surprised me", isCorrect: false },
            { text: "I wasn't paying attention", isCorrect: false },
            { text: "When help arrived", isCorrect: true }
        ]
    },
    {
        question: "How could you use this story's lesson in real life?",
        options: [
            { text: "By being kind to others", isCorrect: true },
            { text: "I can't use it", isCorrect: false },
            { text: "By ignoring everyone", isCorrect: false },
            { text: "By helping friends", isCorrect: true }
        ]
    },
    {
        question: "What made the main character special?",
        options: [
            { text: "Their bravery", isCorrect: true },
            { text: "Nothing", isCorrect: false },
            { text: "They were mean", isCorrect: false },
            { text: "Their kindness", isCorrect: true }
        ]
    },
    {
        question: "Would you want to be friends with the main character?",
        options: [
            { text: "Yes, they seem nice!", isCorrect: true },
            { text: "No way", isCorrect: false },
            { text: "Maybe", isCorrect: false },
            { text: "Absolutely!", isCorrect: true }
        ]
    }
];

const getFallbackQuestions = (attemptNumber = 1) => {
    const questions = attemptNumber === 2 ? FALLBACK_QUESTIONS_ATTEMPT2 : FALLBACK_QUESTIONS_ATTEMPT1;
    return JSON.parse(JSON.stringify(questions));
};

// Helper to call Gemini API
const callGemini = async (systemPrompt, userPrompt, apiKey) => {
    // Use v1 endpoint with gemini-2.0-flash (latest stable model)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    try {
        const response = await axios.post(url, {
            contents: [{
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
                responseMimeType: "application/json"
            }
        });
        
        if (response.data.candidates && response.data.candidates.length > 0) {
            return response.data.candidates[0].content.parts[0].text;
        }
        throw new Error('No candidates returned from Gemini');
    } catch (error) {
        console.error('Gemini API Details:', error.response?.data);
        throw new Error(`Gemini API Error: ${error.response?.data?.error?.message || error.message}`);
    }
};

// Helper to save quiz and response
const saveAndReturnQuiz = async (res, bookId, existingQuiz, userAge, ageGroup, currentAttempt, questions, bookTitle) => {
    // Create or update the quiz
    if (!existingQuiz) {
        existingQuiz = new BookQuiz({
            bookId,
            ageGroupedQuestions: [],
            attempts: []
        });
    }
    
    // Add questions for this age group and attempt
    existingQuiz.setQuestionsForAge(userAge, questions, currentAttempt);
    await existingQuiz.save();

    console.log(`✅ Quiz saved for book: ${bookTitle}, age group: ${ageGroup}, attempt ${currentAttempt}`);

    return res.json({
        quiz: {
            ...existingQuiz.toObject(),
            questions, // Return the questions for this age group and attempt
            ageGroup,
            attemptNumber: currentAttempt
        },
        cached: false
    });
};

// POST /api/quiz/generate - Generate a quiz for a book using AI
router.post('/generate', async (req, res) => {
    try {
        const { bookId, age, attemptNumber = 1 } = req.body;

        if (!bookId) {
            return res.status(400).json({ message: 'bookId is required' });
        }

        // Determine age group
        const userAge = parseInt(age) || 6; // Default to 6 if not provided
        const ageGroup = BookQuiz.getAgeGroup(userAge);
        const currentAttempt = parseInt(attemptNumber) || 1;
        
        console.log(`📚 Quiz request for book ${bookId}, age ${userAge} (group: ${ageGroup}), attempt ${currentAttempt}`);

        // Check if quiz already exists for this book
        let existingQuiz = await BookQuiz.findOne({ bookId });
        
        // Check if we already have questions for this age group and attempt
        if (existingQuiz && existingQuiz.hasQuestionsForAge(userAge, currentAttempt)) {
            console.log(`📚 Quiz already exists for book ${bookId}, age group ${ageGroup}, attempt ${currentAttempt}`);
            return res.json({
                quiz: {
                    ...existingQuiz.toObject(),
                    questions: existingQuiz.getQuestionsForAge(userAge, currentAttempt),
                    ageGroup,
                    attemptNumber: currentAttempt
                },
                cached: true
            });
        }

        // Get book details
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // Get all pages for the book to extract the story content
        const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
        
        // Extract text content from all pages
        let storyContent = '';
        pages.forEach(page => {
            if (page.content && page.content.textBoxes) {
                page.content.textBoxes.forEach(tb => {
                    if (tb.text) {
                        // Remove emotional cues like [excited], [pause], etc.
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) {
                            storyContent += cleanText + ' ';
                        }
                    }
                });
            }
            // Also check legacy textBoxes field
            if (page.textBoxes) {
                page.textBoxes.forEach(tb => {
                    if (tb.text) {
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) {
                            storyContent += cleanText + ' ';
                        }
                    }
                });
            }
        });

        if (!storyContent.trim()) {
            return res.status(400).json({ message: 'No story content found in book pages' });
        }

        console.log('📖 Generating quiz for book:', book.title, 'Age group:', ageGroup);
        console.log('📝 Story content length:', storyContent.length, 'characters');

        // AI Generation Strategy: OpenAI -> Gemini -> Fallback
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        
        let questions = [];
        let useFallback = false;
        let aiSuccess = false;

        const agePrompt = getAgeAppropriatePrompt(userAge, ageGroup);
        const attemptInstruction = currentAttempt === 2 
            ? `\n\nIMPORTANT: This is attempt #2. You MUST create 6 COMPLETELY DIFFERENT questions than a first attempt would have. Focus on different story details, different characters, different events, and different lessons. But ALL questions MUST still be based on THIS SPECIFIC STORY - do NOT create generic questions.`
            : '';

        const systemPrompt = `${agePrompt}
        
        Create exactly 6 multiple-choice questions based on the story content provided below. ALL questions MUST be specifically about events, characters, and details from THIS story - do NOT create generic questions.${attemptInstruction}
        
        General Rules:
        1. Create exactly 6 multiple-choice questions
        2. Each question should have exactly 4 options (A, B, C, D)
        3. Only ONE option should be correct per question
        4. Questions should test comprehension, not trick the child
        5. Questions should cover different parts of the story
        6. Include questions about characters, events, and feelings
        7. Make the quiz fun and encouraging
        
        Return your response as a valid JSON array with this exact structure:
        [
          {
            "question": "What did the main character do first?",
            "options": [
              { "text": "Went to school", "isCorrect": false },
              { "text": "Ate breakfast", "isCorrect": true },
              { "text": "Played outside", "isCorrect": false },
              { "text": "Read a book", "isCorrect": false }
            ]
          }
        ]
        
        Return ONLY the JSON array, no explanations or markdown.`;

        const userPrompt = `Create a 6-question quiz for a ${userAge}-year-old child about this story titled "${book.title}":\n\n${storyContent.substring(0, 4000)}`;

        // 1. Try OpenAI (Primary)
        if (openaiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting generation with OpenAI...');
                console.log('🔑 OpenAI key prefix:', openaiKey?.substring(0, 10) + '...');
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${openaiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
        
                const content = response.data.choices[0].message.content.trim();
                console.log('🤖 OpenAI Response length:', content.length);
                questions = extractJson(content);
                if (Array.isArray(questions) && questions.length > 0) {
                    aiSuccess = true;
                    console.log('✅ OpenAI generation successful');
                }
            } catch (apiError) {
                console.error('❌ OpenAI generation failed:', {
                    message: apiError.message,
                    status: apiError.response?.status,
                    statusText: apiError.response?.statusText,
                    data: JSON.stringify(apiError.response?.data || {}),
                });
            }
        }

        // 2. Try Gemini (Fallback)
        if (geminiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting generation with Gemini (fallback)...');
                const content = await callGemini(systemPrompt, userPrompt, geminiKey);
                console.log('🤖 Gemini Response length:', content.length);
                questions = extractJson(content);
                if (Array.isArray(questions) && questions.length > 0) {
                    aiSuccess = true;
                    console.log('✅ Gemini generation successful');
                }
            } catch (error) {
                console.error('❌ Gemini generation failed:', error.message);
            }
        }

        // 3. Static Fallback
        if (!aiSuccess) {
            console.log(`⚠️ All AI providers failed or keys missing, using fallback questions for attempt ${currentAttempt}`);
            useFallback = true;
            questions = getFallbackQuestions(currentAttempt);
        }

        // Validate final questions structure
        if (!Array.isArray(questions) || questions.length === 0) {
            console.error('Invalid questions array after all attempts, forcing fallback');
            questions = getFallbackQuestions(currentAttempt);
        }
        
        // Ensure exactly 6 questions (pad or slice if needed)
        if (questions.length > 6) {
            questions = questions.slice(0, 6);
        }
        
        // Normalize structure
        questions = questions.map(q => ({
            question: q.question,
            options: Array.isArray(q.options) ? q.options.map(o => ({
                text: o.text || o.answer || '', // Handle varied AI output
                isCorrect: !!o.isCorrect
            })) : []
        }));

        // Save and return
        return saveAndReturnQuiz(res, bookId, existingQuiz, userAge, ageGroup, currentAttempt, questions, book.title);

    } catch (error) {
        console.error('Quiz Generation Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Failed to generate quiz', error: error.message });
    }
});

// POST /api/quiz/generate-first - Generate just the first question quickly
router.post('/generate-first', async (req, res) => {
    try {
        const { bookId, age, attemptNumber = 1 } = req.body;

        if (!bookId) {
            return res.status(400).json({ message: 'bookId is required' });
        }

        const userAge = parseInt(age) || 6;
        const ageGroup = BookQuiz.getAgeGroup(userAge);
        const currentAttempt = parseInt(attemptNumber) || 1;

        // Check if quiz already exists for this attempt
        let existingQuiz = await BookQuiz.findOne({ bookId });
        if (existingQuiz && existingQuiz.hasQuestionsForAge(userAge, currentAttempt)) {
            const questions = existingQuiz.getQuestionsForAge(userAge, currentAttempt);
            return res.json({
                firstQuestion: questions[0],
                totalQuestions: questions.length,
                cached: true,
                ageGroup,
                attemptNumber: currentAttempt
            });
        }

        // Get book and story content
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
        let storyContent = '';
        pages.forEach(page => {
            if (page.content && page.content.textBoxes) {
                page.content.textBoxes.forEach(tb => {
                    if (tb.text) {
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) storyContent += cleanText + ' ';
                    }
                });
            }
            if (page.textBoxes) {
                page.textBoxes.forEach(tb => {
                    if (tb.text) {
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) storyContent += cleanText + ' ';
                    }
                });
            }
        });

        if (!storyContent.trim()) {
            return res.status(400).json({ message: 'No story content found' });
        }

        // Generate just ONE question quickly
        console.log(`⚡ Quick-generating first question for book: ${book.title}, attempt ${currentAttempt}`);
        
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        
        const agePrompt = getAgeAppropriatePrompt(userAge, ageGroup);
        const attemptInstruction = currentAttempt === 2 
            ? `\n\nIMPORTANT: This is attempt #2. Create a DIFFERENT warm-up question than attempt #1 would have - focus on a different detail or character from the story. But the question MUST still be specifically about THIS STORY.`
            : '';

        const systemPrompt = `${agePrompt}

Create exactly 1 multiple-choice question based on the story provided below. This should be an easy warm-up question about the beginning of the story. The question MUST be specifically about events, characters, or details from THIS story - do NOT create a generic question.${attemptInstruction}

Rules:
1. Create exactly 1 question about THIS SPECIFIC STORY
2. 4 options (A, B, C, D), only ONE correct
3. Make it about something from the start of the story
4. Keep it fun and encouraging

Return ONLY a JSON object (not array):
{
  "question": "What happened at the beginning?",
  "options": [
    { "text": "Option A", "isCorrect": false },
    { "text": "Option B", "isCorrect": true },
    { "text": "Option C", "isCorrect": false },
    { "text": "Option D", "isCorrect": false }
  ]
}`;

        const userPrompt = `Create 1 warm-up question for a ${userAge}-year-old about: "${book.title}"\n\nStory: ${storyContent.substring(0, 2000)}`;

        let firstQuestion = null;
        let aiSuccess = false;

        // 1. Try OpenAI (Primary)
        if (openaiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting first question with OpenAI...');
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${openaiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const content = response.data.choices[0].message.content.trim();
                console.log('🤖 OpenAI Response (first question) length:', content.length);
                firstQuestion = extractJson(content);
                if (firstQuestion && firstQuestion.question) {
                    aiSuccess = true;
                    console.log('✅ OpenAI first question successful');
                }
            } catch (apiError) {
                console.error('❌ OpenAI first question failed:', apiError.response?.data?.error?.message || apiError.message);
            }
        }

        // 2. Try Gemini (Fallback)
        if (geminiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting first question with Gemini (fallback)...');
                const content = await callGemini(systemPrompt, userPrompt, geminiKey);
                console.log('🤖 Gemini Response (first question) length:', content.length);
                firstQuestion = extractJson(content);
                if (firstQuestion && firstQuestion.question) {
                    aiSuccess = true;
                    console.log('✅ Gemini first question successful');
                }
            } catch (error) {
                console.error('❌ Gemini first question failed:', error.message);
            }
        }

        // 3. Static Fallback
        if (!aiSuccess) {
            console.log(`⚠️ All AI providers failed, using fallback first question for attempt ${currentAttempt}`);
            firstQuestion = getFallbackQuestions(currentAttempt)[0];
        }

        console.log(`✅ First question ready for: ${book.title}, attempt ${currentAttempt}`);

        res.json({
            firstQuestion,
            totalQuestions: 6, // We'll generate 6 total
            cached: false,
            ageGroup,
            attemptNumber: currentAttempt,
            // Signal that remaining questions need to be generated
            needsRemainingQuestions: true
        });

    } catch (error) {
        console.error('First Question Generation Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Failed to generate first question', error: error.message });
    }
});

// POST /api/quiz/generate-remaining - Generate remaining questions (called in background)
router.post('/generate-remaining', async (req, res) => {
    try {
        const { bookId, age, firstQuestion, attemptNumber = 1 } = req.body;

        if (!bookId) {
            return res.status(400).json({ message: 'bookId is required' });
        }

        const userAge = parseInt(age) || 6;
        const ageGroup = BookQuiz.getAgeGroup(userAge);
        const currentAttempt = parseInt(attemptNumber) || 1;

        // Check if full quiz already exists for this attempt
        let existingQuiz = await BookQuiz.findOne({ bookId });
        if (existingQuiz && existingQuiz.hasQuestionsForAge(userAge, currentAttempt)) {
            const questions = existingQuiz.getQuestionsForAge(userAge, currentAttempt);
            if (questions.length >= 6) {
                return res.json({
                    questions,
                    cached: true,
                    ageGroup,
                    attemptNumber: currentAttempt
                });
            }
        }

        // Get book and story content
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
        let storyContent = '';
        pages.forEach(page => {
            if (page.content && page.content.textBoxes) {
                page.content.textBoxes.forEach(tb => {
                    if (tb.text) {
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) storyContent += cleanText + ' ';
                    }
                });
            }
            if (page.textBoxes) {
                page.textBoxes.forEach(tb => {
                    if (tb.text) {
                        const cleanText = tb.text.replace(/\[[^\]]+\]/g, '').trim();
                        if (cleanText) storyContent += cleanText + ' ';
                    }
                });
            }
        });

        // Generate remaining 5 questions
        console.log(`📝 Generating remaining questions for: ${book.title}, attempt ${currentAttempt}`);
        
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        
        const agePrompt = getAgeAppropriatePrompt(userAge, ageGroup);
        const attemptInstruction = currentAttempt === 2 
            ? `\n\nIMPORTANT: This is attempt #2. Create 5 COMPLETELY DIFFERENT questions than attempt #1 would have - focus on different story details, different scenes, different character actions. But ALL questions MUST still be specifically about THIS STORY - do NOT create generic questions.`
            : '';

        const systemPrompt = `${agePrompt}

Create exactly 5 more multiple-choice questions based on the story provided below. The first question was already asked: "${firstQuestion?.question || 'a warm-up question'}"${attemptInstruction}

Rules:
1. Create exactly 5 NEW questions about THIS SPECIFIC STORY (different from the first one)
2. Each has 4 options (A, B, C, D), only ONE correct
3. Cover different parts of the story (middle and end)
4. Include variety: characters, events, feelings, lessons from THIS story
5. Do NOT create generic questions - every question must reference specific story content
6. Make it fun!

Return ONLY a JSON array:
[
  { "question": "...", "options": [{ "text": "...", "isCorrect": false }, ...] },
  ...
]`;

        const userPrompt = `Create 5 more questions for a ${userAge}-year-old about: "${book.title}"\n\nStory: ${storyContent.substring(0, 4000)}`;

        let remainingQuestions = [];
        let aiSuccess = false;

        // 1. Try OpenAI (Primary)
        if (openaiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting remaining questions with OpenAI...');
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${openaiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const content = response.data.choices[0].message.content.trim();
                console.log('📝 OpenAI response for remaining questions length:', content.length);
                remainingQuestions = extractJson(content);
                if (Array.isArray(remainingQuestions) && remainingQuestions.length > 0) {
                    aiSuccess = true;
                    console.log(`✅ OpenAI remaining questions successful: ${remainingQuestions.length} questions`);
                }
            } catch (apiError) {
                console.error('❌ OpenAI remaining questions failed:', apiError.response?.data?.error?.message || apiError.message);
            }
        }

        // 2. Try Gemini (Fallback)
        if (geminiKey && !aiSuccess) {
            try {
                console.log('🤖 Attempting remaining questions with Gemini (fallback)...');
                const content = await callGemini(systemPrompt, userPrompt, geminiKey);
                console.log('📝 Gemini response for remaining questions length:', content.length);
                remainingQuestions = extractJson(content);
                if (Array.isArray(remainingQuestions) && remainingQuestions.length > 0) {
                    aiSuccess = true;
                    console.log(`✅ Gemini remaining questions successful: ${remainingQuestions.length} questions`);
                }
            } catch (error) {
                console.error('❌ Gemini remaining questions failed:', error.message);
            }
        }

        // 3. Static Fallback
        if (!aiSuccess) {
            console.log(`⚠️ All AI providers failed, using fallback remaining questions for attempt ${currentAttempt}`);
            const fallback = getFallbackQuestions(currentAttempt);
            remainingQuestions = fallback.slice(1); // Skip first question (already generated)
        }

        // Validate remaining questions
        if (!Array.isArray(remainingQuestions)) {
            console.error('Remaining questions is not an array:', typeof remainingQuestions);
            const fallback = getFallbackQuestions(currentAttempt);
            remainingQuestions = fallback.slice(1);
        }

        // Combine first question with remaining
        const allQuestions = [firstQuestion, ...remainingQuestions].filter(Boolean);
        console.log(`📝 Total questions after combining: ${allQuestions.length}`);

        // Save to database
        if (!existingQuiz) {
            existingQuiz = new BookQuiz({
                bookId,
                ageGroupedQuestions: [],
                attempts: []
            });
        }
        existingQuiz.setQuestionsForAge(userAge, allQuestions, currentAttempt);
        await existingQuiz.save();

        console.log(`✅ All ${allQuestions.length} questions saved for: ${book.title}, attempt ${currentAttempt}`);

        res.json({
            questions: allQuestions,
            cached: false,
            ageGroup,
            attemptNumber: currentAttempt
        });

    } catch (error) {
        console.error('Remaining Questions Generation Error:', error);
        console.error('Error details:', error.response?.data || error.message || error.stack);
        res.status(500).json({ 
            message: 'Failed to generate remaining questions', 
            error: error.message,
            details: error.response?.data || null
        });
    }
});

// DELETE /api/quiz/:bookId/clear - Clear cached quiz to force regeneration
router.delete('/:bookId/clear', async (req, res) => {
    try {
        const { bookId } = req.params;
        
        const result = await BookQuiz.deleteOne({ bookId });
        
        if (result.deletedCount > 0) {
            console.log(`🗑️ Cleared cached quiz for book ${bookId}`);
            return res.json({ message: 'Quiz cache cleared', bookId });
        } else {
            return res.status(404).json({ message: 'No cached quiz found for this book' });
        }
    } catch (error) {
        console.error('Clear Quiz Cache Error:', error.message);
        res.status(500).json({ message: 'Failed to clear quiz cache', error: error.message });
    }
});

// GET /api/quiz/:bookId - Get quiz for a book
router.get('/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { userId, age, attemptNumber } = req.query;

        console.log(`📚 Quiz GET request for book ${bookId}, age ${age || 6}, attempt ${attemptNumber || 1}`);

        const quiz = await BookQuiz.findOne({ bookId });
        
        if (!quiz) {
            console.log(`❌ No cached quiz found for book ${bookId}`);
            return res.status(404).json({ message: 'Quiz not found for this book' });
        }

        const userAge = parseInt(age) || 6;
        const ageGroup = BookQuiz.getAgeGroup(userAge);
        const currentAttempt = parseInt(attemptNumber) || 1;
        
        // Get questions for the user's age group and attempt
        const questions = quiz.getQuestionsForAge(userAge, currentAttempt);
        
        if (!questions || questions.length === 0) {
            console.log(`❌ No questions for age group ${ageGroup}, attempt ${currentAttempt}`);
            return res.status(404).json({ 
                message: 'Quiz not found for this age group and attempt',
                needsGeneration: true,
                ageGroup,
                attemptNumber: currentAttempt
            });
        }

        console.log(`✅ Returning CACHED quiz for book ${bookId}: ${questions.length} questions (age: ${ageGroup}, attempt: ${currentAttempt})`);
        
        // Log first question to help debug if it's AI-generated or fallback
        if (questions[0]) {
            console.log(`📝 First cached question: "${questions[0].question?.substring(0, 50)}..."`);
        }

        // Get user's attempt count
        const attemptCount = userId ? quiz.getUserAttemptCount(userId) : 0;
        const canTakeQuiz = userId ? quiz.canUserTakeQuiz(userId) : true;

        res.json({
            quiz: {
                ...quiz.toObject(),
                questions, // Return only the age-appropriate questions for this attempt
                ageGroup,
                attemptNumber: currentAttempt
            },
            attemptCount,
            canTakeQuiz,
            maxAttempts: 2
        });

    } catch (error) {
        console.error('Get Quiz Error:', error.message);
        res.status(500).json({ message: 'Failed to get quiz', error: error.message });
    }
});

// POST /api/quiz/:bookId/submit - Submit quiz answers
router.post('/:bookId/submit', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { userId, answers, age, attemptNumber } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ message: 'answers array is required' });
        }

        const quiz = await BookQuiz.findOne({ bookId });
        
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found for this book' });
        }

        // Check if user can still take the quiz
        if (!quiz.canUserTakeQuiz(userId)) {
            return res.status(400).json({ 
                message: 'Maximum attempts reached',
                attemptCount: 2,
                maxAttempts: 2
            });
        }

        // Get questions for the user's age group and current attempt
        const userAge = parseInt(age) || 6;
        const currentAttempt = parseInt(attemptNumber) || (quiz.getUserAttemptCount(userId) + 1);
        const questions = quiz.getQuestionsForAge(userAge, currentAttempt);
        
        if (!questions || questions.length === 0) {
            return res.status(404).json({ message: 'Quiz questions not found for this age group and attempt' });
        }

        // Calculate score
        let correctCount = 0;
        const results = questions.map((q, index) => {
            const userAnswer = answers[index];
            const correctOption = q.options.findIndex(opt => opt.isCorrect);
            const isCorrect = userAnswer === correctOption;
            if (isCorrect) correctCount++;
            return {
                questionIndex: index,
                userAnswer,
                correctAnswer: correctOption,
                isCorrect
            };
        });

        // Calculate coins (10 per correct answer)
        const coinsEarned = correctCount * 10;

        // Record the attempt
        const newAttemptNumber = quiz.addAttempt(userId, correctCount, coinsEarned);
        await quiz.save();

        console.log(`📊 Quiz submitted (age ${userAge}): ${correctCount}/6 correct, ${coinsEarned} coins earned`);

        res.json({
            score: correctCount,
            totalQuestions: 6,
            coinsEarned,
            attemptNumber: newAttemptNumber,
            attemptsRemaining: 2 - newAttemptNumber,
            results
        });

    } catch (error) {
        console.error('Submit Quiz Error:', error.message);
        res.status(500).json({ message: 'Failed to submit quiz', error: error.message });
    }
});

// GET /api/quiz/:bookId/attempts/:userId - Get user's attempts for a book quiz
router.get('/:bookId/attempts/:userId', async (req, res) => {
    try {
        const { bookId, userId } = req.params;

        const quiz = await BookQuiz.findOne({ bookId });
        
        if (!quiz) {
            return res.json({
                attemptCount: 0,
                canTakeQuiz: true,
                maxAttempts: 2,
                attempts: []
            });
        }

        const userAttempts = quiz.attempts.filter(a => a.godlykids_user_id === userId);
        const attemptCount = userAttempts.length;

        res.json({
            attemptCount,
            canTakeQuiz: attemptCount < 2,
            maxAttempts: 2,
            attempts: userAttempts
        });

    } catch (error) {
        console.error('Get Attempts Error:', error.message);
        res.status(500).json({ message: 'Failed to get attempts', error: error.message });
    }
});

// GET /api/quiz/:bookId/age-groups - Get available age groups for a book's quiz
router.get('/:bookId/age-groups', async (req, res) => {
    try {
        const { bookId } = req.params;

        const quiz = await BookQuiz.findOne({ bookId });
        
        if (!quiz) {
            return res.json({ ageGroups: [] });
        }

        const ageGroups = quiz.ageGroupedQuestions.map(g => ({
            ageGroup: g.ageGroup,
            questionCount: g.questions.length
        }));

        res.json({ ageGroups });

    } catch (error) {
        console.error('Get Age Groups Error:', error.message);
        res.status(500).json({ message: 'Failed to get age groups', error: error.message });
    }
});

module.exports = router;
