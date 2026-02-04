const express = require('express');
const router = express.Router();
const AmazonBook = require('../models/AmazonBook');
const mongoose = require('mongoose');

// GET all Amazon books (with pagination support)
router.get('/', async (req, res) => {
    try {
        // Wait for MongoDB connection if it's still connecting
        if (mongoose.connection.readyState === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        
        if (mongoose.connection.readyState !== 1) {
            if (mongoose.connection.readyState === 0) {
                try {
                    await mongoose.connect(process.env.MONGO_URI);
                } catch (connectError) {
                    return res.status(503).json({ 
                        message: 'Database connection failed.',
                        error: connectError.message
                    });
                }
            } else {
                return res.status(503).json({ 
                    message: 'Database is connecting. Please try again in a moment.',
                    error: 'Database connection in progress'
                });
            }
        }
        
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        
        // Filter parameters
        const filter = {};
        if (req.query.status === 'all') {
            // Don't filter by status - show all
        } else if (req.query.status) {
            filter.status = req.query.status;
        } else {
            // Default: only show published books
            filter.status = 'published';
        }
        if (req.query.category) filter.category = req.query.category;
        
        const total = await AmazonBook.countDocuments(filter);
        
        const books = await AmazonBook.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        res.json({
            data: books,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET featured Amazon books for carousel
router.get('/featured', async (req, res) => {
    try {
        const books = await AmazonBook.find({ 
            isFeatured: true, 
            status: 'published' 
        }).sort({ featuredOrder: 1, createdAt: -1 }).lean();
        
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single Amazon book
router.get('/:id', async (req, res) => {
    try {
        const book = await AmazonBook.findById(req.params.id).lean();
        if (!book) return res.status(404).json({ message: 'Amazon book not found' });
        
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create Amazon book
router.post('/', async (req, res) => {
    try {
        // Validate required fields
        if (!req.body.title) {
            return res.status(400).json({ message: 'Title is required' });
        }
        if (!req.body.author) {
            return res.status(400).json({ message: 'Author is required' });
        }
        if (!req.body.amazonUrl) {
            return res.status(400).json({ message: 'Amazon URL is required' });
        }
        if (!req.body.coverImage) {
            return res.status(400).json({ message: 'Cover image is required' });
        }
        
        const bookData = {
            title: req.body.title,
            author: req.body.author,
            description: req.body.description || '',
            amazonUrl: req.body.amazonUrl,
            asin: req.body.asin || '',
            price: req.body.price || '',
            coverImage: req.body.coverImage,
            category: req.body.category || 'Other',
            categories: req.body.categories || [],
            minAge: req.body.minAge ? Number(req.body.minAge) : undefined,
            maxAge: req.body.maxAge ? Number(req.body.maxAge) : undefined,
            status: req.body.status || 'draft',
            isFeatured: req.body.isFeatured || false,
            featuredOrder: req.body.featuredOrder || 0,
            badgeText: req.body.badgeText || '',
            badgeColor: req.body.badgeColor || '#f59e0b',
        };

        const book = new AmazonBook(bookData);
        const newBook = await book.save();
        
        console.log('📚 Amazon book created:', newBook._id, newBook.title);
        res.status(201).json(newBook);
    } catch (error) {
        console.error('Error creating Amazon book:', error);
        res.status(400).json({ 
            message: error.message, 
            error: error.name,
            details: error.errors || error
        });
    }
});

// PUT update Amazon book
router.put('/:id', async (req, res) => {
    try {
        const book = await AmazonBook.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Amazon book not found' });

        // Update fields
        const updateFields = [
            'title', 'author', 'description', 'amazonUrl', 'asin', 'price',
            'coverImage', 'category', 'categories', 'minAge', 'maxAge',
            'status', 'isFeatured', 'featuredOrder', 'badgeText', 'badgeColor'
        ];
        
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                book[field] = req.body[field];
            }
        });
        
        const updatedBook = await book.save();
        console.log('📚 Amazon book updated:', updatedBook._id, updatedBook.title);
        
        res.json(updatedBook);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE Amazon book
router.delete('/:id', async (req, res) => {
    try {
        const book = await AmazonBook.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Amazon book not found' });

        await book.deleteOne();
        console.log('📚 Amazon book deleted:', req.params.id);
        res.json({ message: 'Amazon book deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST increment click count (called when user clicks to view on Amazon)
router.post('/:id/click', async (req, res) => {
    try {
        const book = await AmazonBook.findByIdAndUpdate(
            req.params.id,
            { $inc: { clickCount: 1 } },
            { new: true }
        );
        
        if (!book) {
            return res.status(404).json({ message: 'Amazon book not found' });
        }
        
        console.log(`🛒 Amazon book "${book.title}" clicked - clickCount: ${book.clickCount}`);
        res.json({ clickCount: book.clickCount });
    } catch (error) {
        console.error('Error incrementing click count:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
