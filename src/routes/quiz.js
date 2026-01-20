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
// These are theological/faith-based generic questions
const FALLBACK_QUESTIONS_ATTEMPT1 = [
    {
        question: "What does this story teach us about God's love?",
        options: [
            { text: "God loves us no matter what", isCorrect: true },
            { text: "God only loves perfect people", isCorrect: false },
            { text: "God doesn't care about us", isCorrect: false },
            { text: "We have to earn God's love", isCorrect: false }
        ]
    },
    {
        question: "Which fruit of the Spirit did the main character show?",
        options: [
            { text: "Love and kindness", isCorrect: true },
            { text: "Anger and meanness", isCorrect: false },
            { text: "Selfishness", isCorrect: false },
            { text: "None at all", isCorrect: false }
        ]
    },
    {
        question: "What is the right thing to do when we face problems?",
        options: [
            { text: "Pray and trust God", isCorrect: true },
            { text: "Give up and run away", isCorrect: false },
            { text: "Be angry at everyone", isCorrect: false },
            { text: "Pretend nothing happened", isCorrect: false }
        ]
    },
    {
        question: "How can we follow Jesus's example from this story?",
        options: [
            { text: "By being kind and helpful to others", isCorrect: true },
            { text: "By only thinking about ourselves", isCorrect: false },
            { text: "By being mean to people we don't like", isCorrect: false },
            { text: "By ignoring people who need help", isCorrect: false }
        ]
    },
    {
        question: "What does the Bible teach us about treating others?",
        options: [
            { text: "Love your neighbor as yourself", isCorrect: true },
            { text: "Only be nice to your friends", isCorrect: false },
            { text: "It's okay to be mean sometimes", isCorrect: false },
            { text: "Don't help anyone", isCorrect: false }
        ]
    },
    {
        question: "What good choice did the character make in this story?",
        options: [
            { text: "Following God's way and being good", isCorrect: true },
            { text: "Being selfish", isCorrect: false },
            { text: "Ignoring what's right", isCorrect: false },
            { text: "Giving up easily", isCorrect: false }
        ]
    }
];

// Different fallback questions for attempt 2 - also theological
const FALLBACK_QUESTIONS_ATTEMPT2 = [
    {
        question: "What virtue from the Bible did this story show?",
        options: [
            { text: "Faith and trust in God", isCorrect: true },
            { text: "Being mean to others", isCorrect: false },
            { text: "Giving up when things are hard", isCorrect: false },
            { text: "Only caring about yourself", isCorrect: false }
        ]
    },
    {
        question: "How does God want us to treat people who are different from us?",
        options: [
            { text: "With love and respect", isCorrect: true },
            { text: "Ignore them", isCorrect: false },
            { text: "Be mean to them", isCorrect: false },
            { text: "Only talk to people like us", isCorrect: false }
        ]
    },
    {
        question: "What does it mean to have courage like in this story?",
        options: [
            { text: "Trusting God even when we're scared", isCorrect: true },
            { text: "Never being afraid of anything", isCorrect: false },
            { text: "Fighting everyone", isCorrect: false },
            { text: "Running away from problems", isCorrect: false }
        ]
    },
    {
        question: "Why is forgiveness important according to the Bible?",
        options: [
            { text: "God forgives us, so we should forgive others", isCorrect: true },
            { text: "Forgiveness is not important", isCorrect: false },
            { text: "We should never forgive anyone", isCorrect: false },
            { text: "Only forgive people we like", isCorrect: false }
        ]
    },
    {
        question: "How can we show God's love to others?",
        options: [
            { text: "By being kind, patient, and helpful", isCorrect: true },
            { text: "By keeping God's love to ourselves", isCorrect: false },
            { text: "By being selfish", isCorrect: false },
            { text: "By only loving our family", isCorrect: false }
        ]
    },
    {
        question: "What does this story teach about being a good friend?",
        options: [
            { text: "Good friends are loyal, kind, and forgiving", isCorrect: true },
            { text: "Only be friends with cool people", isCorrect: false },
            { text: "Friends should do everything you say", isCorrect: false },
            { text: "Friendship isn't important", isCorrect: false }
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
        
        Create exactly 6 multiple-choice questions based on the Christian children's story provided below. This is a faith-based educational app, so questions should emphasize THEOLOGICAL and BIBLICAL themes.${attemptInstruction}
        
        Question Types to Include (mix these):
        1. FAITH LESSONS: "What does this story teach us about God/Jesus/faith?"
        2. BIBLICAL VALUES: "What virtue/fruit of the Spirit did [character] show?" (love, kindness, patience, forgiveness, courage, honesty, generosity, etc.)
        3. CHARACTER CHOICES: "What was the RIGHT thing [character] did?" or "How did [character] follow God's way?"
        4. STORY COMPREHENSION: Basic "what happened" questions about the plot
        5. SPIRITUAL APPLICATION: "What can we learn from [character]'s example?"
        6. BIBLICAL CONNECTIONS: If the story references Bible stories, ask about those connections
        
        General Rules:
        1. Create exactly 6 multiple-choice questions
        2. Each question should have exactly 4 options (A, B, C, D)
        3. Only ONE option should be correct per question
        4. At least 3 questions should focus on THEOLOGICAL/FAITH themes
        5. Questions should be encouraging and help children grow in faith
        6. Reference specific events, characters, and details from THIS story
        7. Make it fun while teaching Biblical values!
        
        Return your response as a valid JSON array with this exact structure:
        [
          {
            "question": "What important lesson about kindness does this story teach?",
            "options": [
              { "text": "Being kind to others makes God happy", "isCorrect": true },
              { "text": "Kindness is not important", "isCorrect": false },
              { "text": "Only be kind to friends", "isCorrect": false },
              { "text": "Kindness makes you weak", "isCorrect": false }
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

Create exactly 1 multiple-choice question based on this Christian children's story. This should be an easy warm-up question that introduces the story's faith theme or main character. Make it encouraging and age-appropriate.${attemptInstruction}

Rules:
1. Create exactly 1 question about THIS SPECIFIC STORY
2. 4 options (A, B, C, D), only ONE correct
3. Focus on: the main character, an early story event, OR the faith theme being introduced
4. Keep it fun, encouraging, and faith-affirming!

Return ONLY a JSON object (not array):
{
  "question": "Who is the main character learning about God's love?",
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

Create exactly 5 more multiple-choice questions based on this Christian children's story. The first question was already asked: "${firstQuestion?.question || 'a warm-up question'}"${attemptInstruction}

Question Types to Include (mix these):
- FAITH LESSONS: "What does this story teach us about God/Jesus/faith?"
- BIBLICAL VALUES: "What virtue did [character] show?" (love, kindness, patience, forgiveness, courage, honesty, generosity)
- RIGHT CHOICES: "What was the godly choice [character] made?"
- STORY EVENTS: What happened in the middle/end of the story
- SPIRITUAL APPLICATION: "What can we learn from this story?"

Rules:
1. Create exactly 5 NEW questions (different from the first one)
2. Each has 4 options (A, B, C, D), only ONE correct
3. At least 2-3 questions should focus on THEOLOGICAL themes (faith, God, Biblical values)
4. Cover middle and end of the story
5. Reference specific events and characters from THIS story
6. Make it encouraging and help children grow in faith!

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
