const express = require('express');
const router = express.Router();
const axios = require('axios');
const BookQuiz = require('../models/BookQuiz');
const Book = require('../models/Book');
const Page = require('../models/Page');

// POST /api/quiz/generate - Generate a quiz for a book using AI
router.post('/generate', async (req, res) => {
    try {
        const { bookId } = req.body;

        if (!bookId) {
            return res.status(400).json({ message: 'bookId is required' });
        }

        // Check if quiz already exists for this book
        let existingQuiz = await BookQuiz.findOne({ bookId });
        if (existingQuiz && existingQuiz.questions.length > 0) {
            console.log('📚 Quiz already exists for book:', bookId);
            return res.json({
                quiz: existingQuiz,
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

        console.log('📖 Generating quiz for book:', book.title);
        console.log('📝 Story content length:', storyContent.length, 'characters');

        // Use OpenAI to generate quiz questions
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            return res.status(500).json({ message: 'OpenAI API key not configured' });
        }

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a children's book quiz creator. Create engaging, age-appropriate quiz questions based on the story content provided.

Rules:
1. Create exactly 6 multiple-choice questions
2. Each question should have exactly 4 options (A, B, C, D)
3. Only ONE option should be correct per question
4. Questions should test comprehension, not trick the child
5. Use simple, child-friendly language
6. Questions should cover different parts of the story
7. Include questions about characters, events, lessons, and feelings
8. Make the quiz fun and encouraging

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

Return ONLY the JSON array, no explanations or markdown.`
                    },
                    {
                        role: 'user',
                        content: `Create a 6-question quiz for this children's story titled "${book.title}":\n\n${storyContent.substring(0, 4000)}`
                    }
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

        let questions;
        try {
            const content = response.data.choices[0].message.content.trim();
            // Remove markdown code blocks if present
            const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            questions = JSON.parse(jsonContent);
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            return res.status(500).json({ message: 'Failed to parse quiz questions from AI' });
        }

        // Validate questions structure
        if (!Array.isArray(questions) || questions.length !== 6) {
            console.error('Invalid questions array:', questions);
            return res.status(500).json({ message: 'AI generated invalid quiz format' });
        }

        // Create or update the quiz
        if (existingQuiz) {
            existingQuiz.questions = questions;
            await existingQuiz.save();
        } else {
            existingQuiz = new BookQuiz({
                bookId,
                questions,
                attempts: []
            });
            await existingQuiz.save();
        }

        console.log('✅ Quiz generated successfully for book:', book.title);

        res.json({
            quiz: existingQuiz,
            cached: false
        });

    } catch (error) {
        console.error('Quiz Generation Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Failed to generate quiz', error: error.message });
    }
});

// GET /api/quiz/:bookId - Get quiz for a book
router.get('/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { userId } = req.query;

        const quiz = await BookQuiz.findOne({ bookId });
        
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found for this book' });
        }

        // Get user's attempt count
        const attemptCount = userId ? quiz.getUserAttemptCount(userId) : 0;
        const canTakeQuiz = userId ? quiz.canUserTakeQuiz(userId) : true;

        res.json({
            quiz,
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
        const { userId, answers } = req.body;

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

        // Calculate score
        let correctCount = 0;
        const results = quiz.questions.map((q, index) => {
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
        const attemptNumber = quiz.addAttempt(userId, correctCount, coinsEarned);
        await quiz.save();

        console.log(`📊 Quiz submitted: ${correctCount}/6 correct, ${coinsEarned} coins earned`);

        res.json({
            score: correctCount,
            totalQuestions: 6,
            coinsEarned,
            attemptNumber,
            attemptsRemaining: 2 - attemptNumber,
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

module.exports = router;

