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
        if (!req.body.coverImage) {
            return res.status(400).json({ message: 'Cover image is required' });
        }
        // At least one purchase method must be configured: Amazon URL, Stripe
        // Payment Link URL, or a Stripe Price id that we can checkout against.
        if (!req.body.amazonUrl && !req.body.stripePaymentLinkUrl && !req.body.stripePriceId) {
            return res.status(400).json({
                message: 'At least one purchase method (Amazon URL, Stripe Payment Link, or Stripe Price ID) is required',
            });
        }

        const bookData = {
            title: req.body.title,
            author: req.body.author,
            description: req.body.description || '',
            amazonUrl: req.body.amazonUrl || '',
            asin: req.body.asin || '',
            price: req.body.price || '',
            stripePaymentLinkUrl: req.body.stripePaymentLinkUrl || '',
            stripePriceId: req.body.stripePriceId || '',
            coverImage: req.body.coverImage,
            images: Array.isArray(req.body.images) ? req.body.images : [],
            promoVideoUrl: req.body.promoVideoUrl || '',
            reviews: Array.isArray(req.body.reviews) ? req.body.reviews : [],
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
            'stripePaymentLinkUrl', 'stripePriceId',
            'coverImage', 'images', 'promoVideoUrl', 'reviews',
            'category', 'categories', 'minAge', 'maxAge',
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

/**
 * POST /api/amazon-books/:id/checkout-session
 * Returns a URL the buyer should be redirected to for Stripe checkout.
 *   - If the book has stripePaymentLinkUrl, we return it directly.
 *   - Otherwise, if stripePriceId is set, we create a Stripe Checkout Session
 *     on the fly and return session.url.
 * Also increments stripeClickCount for analytics.
 */
router.post('/:id/checkout-session', async (req, res) => {
    try {
        const book = await AmazonBook.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Amazon book not found' });

        // Payment Link path (no backend work required)
        if (book.stripePaymentLinkUrl) {
            await AmazonBook.updateOne({ _id: book._id }, { $inc: { stripeClickCount: 1 } });
            return res.json({ url: book.stripePaymentLinkUrl, mode: 'payment_link' });
        }

        if (!book.stripePriceId) {
            return res.status(400).json({
                message: 'This book does not have Stripe checkout configured',
            });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ message: 'Stripe is not configured on the server' });
        }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        const origin =
            req.body.origin ||
            req.get('origin') ||
            req.get('referer') ||
            'https://bookstore.godlykids.com';
        const normalizedOrigin = origin.replace(/\/$/, '');

        const successUrl =
            req.body.successUrl ||
            `${normalizedOrigin}/?purchase=success&book=${encodeURIComponent(book._id.toString())}`;
        const cancelUrl =
            req.body.cancelUrl ||
            `${normalizedOrigin}/?purchase=canceled&book=${encodeURIComponent(book._id.toString())}`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: book.stripePriceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                bookId: book._id.toString(),
                bookTitle: book.title,
                source: 'bookstore',
            },
        });

        await AmazonBook.updateOne({ _id: book._id }, { $inc: { stripeClickCount: 1 } });

        console.log(`💳 Stripe checkout session created for "${book.title}" -> ${session.id}`);
        res.json({ url: session.url, sessionId: session.id, mode: 'checkout_session' });
    } catch (error) {
        console.error('Error creating Stripe checkout session for book:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
