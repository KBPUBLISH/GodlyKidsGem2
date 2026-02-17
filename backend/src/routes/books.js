const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const SavedCharacter = require('../models/SavedCharacter');
const AppUser = require('../models/AppUser');
const mongoose = require('mongoose');
const { notifyNewBook } = require('../services/notificationService');

/** Resolve userId query (ObjectId, email, or deviceId) to ObjectId for CustomMonthlyBook lookup. */
async function resolveUserIdForBooks(userId) {
    if (!userId) return null;
    if (mongoose.Types.ObjectId.isValid(userId) && String(userId).length === 24) {
        return new mongoose.Types.ObjectId(userId);
    }
    const user = await AppUser.findOne({
        $or: [{ email: userId }, { deviceId: userId }],
    }).select('_id').lean();
    return user ? user._id : null;
}

/** Kid-created (Create Your Story) book IDs — excluded from main catalog, featured, trending, top-rated. */
async function getGeneratedMonthlyBookIds() {
    const ids = await CustomMonthlyBook.find({ bookId: { $exists: true, $ne: null } })
        .distinct('bookId')
        .lean();
    return ids;
}

// GET all books (with pagination support)
router.get('/', async (req, res) => {
    try {
        // Wait for MongoDB connection if it's still connecting
        if (mongoose.connection.readyState === 0) {
            // Not connected yet, wait a bit
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        
        // Check connection state: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        if (mongoose.connection.readyState !== 1) {
            // If still not connected, try to connect
            if (mongoose.connection.readyState === 0) {
                try {
                    await mongoose.connect(process.env.MONGO_URI);
                } catch (connectError) {
                    return res.status(503).json({ 
                        message: 'Database connection failed. Please check MONGO_URI in .env file.',
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
        const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
        const skip = (page - 1) * limit;
        
        // Filter parameters
        const filter = {};
        // Default to published books only, unless explicitly requesting all statuses
        // Portal can pass status=all to get everything, or status=draft for drafts only
        if (req.query.status === 'all') {
            // Don't filter by status - show all
        } else if (req.query.status) {
            filter.status = req.query.status;
        } else {
            // Default: only show published books in the main app
            filter.status = 'published';
        }
        if (req.query.categoryId) filter.categoryId = req.query.categoryId;
        if (req.query.bookType) {
            filter.bookType = req.query.bookType;
        } else if (req.query.status !== 'all') {
            // App list (published): exclude kids_monthly so they only appear as Create Your Story templates
            filter.bookType = { $ne: 'kids_monthly' };
        }

        // Kid-created monthly books (CustomMonthlyBook.bookId) are per-user and must NEVER appear in the
        // main catalog for all users. They only appear in that user's "My Books" via /api/monthly-book/my-books.
        const generatedBookIds = await getGeneratedMonthlyBookIds();
        const onlyGeneratedMonthly = req.query.onlyGeneratedMonthly === '1' || req.query.onlyGeneratedMonthly === 'true';
        if (onlyGeneratedMonthly) {
            // Portal "Kids Monthly Books" tab only: list books that are kid-created (for admin view).
            if (generatedBookIds.length > 0) {
                filter._id = { $in: generatedBookIds };
            } else {
                filter._id = { $in: [] };
            }
        } else {
            // Always exclude kid-created books from the main list (app catalog, portal List tab).
            if (generatedBookIds.length > 0) {
                filter._id = filter._id || {};
                filter._id.$nin = (filter._id.$nin || []).concat(generatedBookIds);
            }
        }

        // Get total count for pagination metadata
        const total = await Book.countDocuments(filter);
        
        // Fetch books with pagination (populate featured character for kids_monthly list)
        let query = Book.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
        if (filter.bookType === 'kids_monthly') {
            query = query.populate('featuredCharacterId', 'displayName');
        }
        const books = await query.lean();
        
        // Map books to include coverImage for backward compatibility
        const booksWithCoverImage = books.map(book => {
            // Add coverImage at root level from files.coverImage for backward compatibility
            if (book.files && book.files.coverImage) {
                book.coverImage = book.files.coverImage;
            } else if (!book.files) {
                // If files doesn't exist (old data), keep coverImage as is
                book.files = { coverImage: book.coverImage || null, images: [], videos: [], audio: [] };
            }
            return book;
        });
        
        // Return with pagination metadata
        res.json({
            data: booksWithCoverImage,
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

// GET featured books for carousel (exclude kid-created books)
router.get('/featured', async (req, res) => {
    try {
        const generatedIds = await getGeneratedMonthlyBookIds();
        const excludeIds = generatedIds.length > 0 ? { _id: { $nin: generatedIds } } : {};
        const books = await Book.find({ 
            isFeatured: true, 
            status: 'published',
            ...excludeIds
        }).sort({ featuredOrder: 1, createdAt: -1 });
        
        // Map books to include coverImage for backward compatibility
        const booksWithCoverImage = books.map(book => {
            const bookObj = book.toObject();
            if (bookObj.files && bookObj.files.coverImage) {
                bookObj.coverImage = bookObj.files.coverImage;
            } else if (!bookObj.files) {
                bookObj.files = { coverImage: bookObj.coverImage || null, images: [], videos: [], audio: [] };
            }
            return bookObj;
        });
        
        res.json(booksWithCoverImage);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET top-rated books (15% or more likes/favorites to reads ratio); exclude kid-created books
router.get('/top-rated', async (req, res) => {
    try {
        const minRatio = parseFloat(req.query.minRatio) || 0.15; // Default 15%
        const minReads = parseInt(req.query.minReads) || 5; // Minimum reads to qualify
        const generatedIds = await getGeneratedMonthlyBookIds();
        const excludeIds = generatedIds.length > 0 ? { _id: { $nin: generatedIds } } : {};
        const books = await Book.find({ 
            status: 'published',
            readCount: { $gte: minReads },
            ...excludeIds
        });
        
        // Calculate rating ratio and filter
        const topRatedBooks = books
            .map(book => {
                const bookObj = book.toObject();
                const totalEngagement = (bookObj.likeCount || 0) + (bookObj.favoriteCount || 0);
                const ratio = bookObj.readCount > 0 ? totalEngagement / bookObj.readCount : 0;
                bookObj.ratingRatio = ratio;
                
                // Add coverImage for backward compatibility
                if (bookObj.files && bookObj.files.coverImage) {
                    bookObj.coverImage = bookObj.files.coverImage;
                }
                return bookObj;
            })
            .filter(book => book.ratingRatio >= minRatio)
            .sort((a, b) => b.ratingRatio - a.ratingRatio); // Sort by highest ratio first
        
        res.json(topRatedBooks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET trending books (top books by engagement score within time window)
// Engagement score = plays + (total pages viewed / 10) + (avg completion % * 2)
router.get('/trending', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const timeWindow = req.query.timeWindow || '7d'; // Default 7 days
        
        // Parse time window to milliseconds
        const windowMs = parseTimeWindow(timeWindow);
        const since = new Date(Date.now() - windowMs);
        
        // Import PlayEvent model
        const PlayEvent = require('../models/PlayEvent');
        
        // Get trending books based on engagement metrics
        const trendingData = await PlayEvent.aggregate([
            { 
                $match: { 
                    contentType: 'book',
                    playedAt: { $gte: since }
                } 
            },
            { 
                $group: { 
                    _id: '$contentId',
                    recentPlays: { $sum: 1 },
                    totalPagesViewed: { $sum: '$pagesViewed' },
                    avgCompletion: { $avg: '$completionPercent' },
                    lastPlayed: { $max: '$playedAt' }
                } 
            },
            {
                // Calculate engagement score:
                // - Each play = 1 point
                // - Every 10 pages viewed = 1 point
                // - Average completion contributes up to 2 points (completion% * 0.02)
                $addFields: {
                    engagementScore: {
                        $add: [
                            '$recentPlays',
                            { $divide: [{ $ifNull: ['$totalPagesViewed', 0] }, 10] },
                            { $multiply: [{ $ifNull: ['$avgCompletion', 0] }, 0.02] }
                        ]
                    }
                }
            },
            // Sort by engagement score (desc), then by lastPlayed (desc), then by _id for consistent ordering
            { $sort: { engagementScore: -1, lastPlayed: -1, _id: 1 } },
            { $limit: limit }
        ]);
        
        // If we have trending data, fetch the book details (exclude kid-created books)
        if (trendingData.length > 0) {
            const generatedIds = await getGeneratedMonthlyBookIds();
            const generatedSet = new Set(generatedIds.map(id => id.toString()));
            const bookIds = trendingData.map(t => t._id).filter(id => !generatedSet.has(id.toString()));
            if (bookIds.length === 0) {
                return res.json([]);
            }
            const books = await Book.find({ 
                _id: { $in: bookIds },
                status: 'published'
            }).lean();
            
            // Create a map for quick lookup
            const bookMap = {};
            books.forEach(book => {
                if (book.files && book.files.coverImage) {
                    book.coverImage = book.files.coverImage;
                }
                bookMap[book._id.toString()] = book;
            });
            
            // Sort by engagement score and format
            const formattedBooks = trendingData
                .map(t => {
                    const book = bookMap[t._id.toString()];
                    if (book) {
                        return { 
                            ...book, 
                            recentPlays: t.recentPlays, 
                            totalPagesViewed: t.totalPagesViewed || 0,
                            avgCompletion: Math.round(t.avgCompletion || 0),
                            engagementScore: Math.round(t.engagementScore * 10) / 10,
                            lastPlayed: t.lastPlayed 
                        };
                    }
                    return null;
                })
                .filter(Boolean);
            
            console.log(`📚 Trending books (${timeWindow}): ${formattedBooks.length} items, top score: ${formattedBooks[0]?.engagementScore}`);
            return res.json(formattedBooks);
        }
        
        // Fallback: If no recent play events, use readCount (exclude kid-created books)
        const generatedIds = await getGeneratedMonthlyBookIds();
        const excludeIds = generatedIds.length > 0 ? { _id: { $nin: generatedIds } } : {};
        const books = await Book.find({ 
            status: 'published',
            readCount: { $gt: 0 },
            ...excludeIds
        })
        .sort({ readCount: -1 })
        .limit(limit)
        .lean();
        
        const formattedBooks = books.map(book => {
            if (book.files && book.files.coverImage) {
                book.coverImage = book.files.coverImage;
            }
            return book;
        });
        
        console.log(`📚 Trending books (fallback): ${formattedBooks.length} items`);
        res.json(formattedBooks);
    } catch (error) {
        console.error('Error fetching trending books:', error);
        res.status(500).json({ message: error.message });
    }
});

// Helper to parse time window string to milliseconds
function parseTimeWindow(window) {
    const match = window.match(/^(\d+)(h|d|w|m)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        case 'm': return value * 30 * 24 * 60 * 60 * 1000;
        default: return 7 * 24 * 60 * 60 * 1000;
    }
}

// GET single book
// Optional query: userId — if provided and this book is a Create Your Story book for that user, response includes isUserCreated: true
// If id is not a Book id, tries CustomMonthlyBook id (same user) and returns the generated Book when completed.
router.get('/:id', async (req, res) => {
    try {
        let book = await Book.findById(req.params.id);
        const rawUserId = req.query.userId || req.query.email || req.query.deviceId;
        const resolvedUserId = rawUserId ? await resolveUserIdForBooks(rawUserId) : null;

        // Fallback: id might be a CustomMonthlyBook id (e.g. link before redirect to bookId)
        if (!book && resolvedUserId) {
            const custom = await CustomMonthlyBook.findOne({
                _id: req.params.id,
                userId: resolvedUserId,
                status: 'completed',
                bookId: { $exists: true, $ne: null },
            })
                .select('bookId')
                .lean();
            if (custom && custom.bookId) {
                book = await Book.findById(custom.bookId);
            }
        }

        if (!book) return res.status(404).json({ message: 'Book not found' });

        const bookObj = book.toObject();
        // Add coverImage at root level from files.coverImage for backward compatibility
        if (bookObj.files && bookObj.files.coverImage) {
            bookObj.coverImage = bookObj.files.coverImage;
        } else if (!bookObj.files) {
            bookObj.files = { coverImage: bookObj.coverImage || null, images: [], videos: [], audio: [] };
        }

        if (resolvedUserId) {
            const custom = await CustomMonthlyBook.findOne({
                bookId: book._id,
                userId: resolvedUserId,
                status: 'completed',
            }).select('_id childName childCharacterImageUrl bookStyleId characters').lean();
            if (custom) {
                bookObj.isUserCreated = true;
                bookObj.createdForChildName = custom.childName || null;
                bookObj.createdForAvatarUrl = custom.childCharacterImageUrl || null;
                bookObj.createdWithStyleId = (custom.bookStyleId && String(custom.bookStyleId).trim()) || null;
                if (custom.characters && custom.characters.length > 0) {
                    bookObj.createdForCharacters = custom.characters.map(c => ({
                        name: c.name,
                        characterImageUrl: c.characterImageUrl || null,
                    }));
                }
            }
        }

        res.json(bookObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create book
router.post('/', async (req, res) => {
    try {
        console.log('Creating book with data:', JSON.stringify(req.body, null, 2));
        
        // Validate required fields
        if (!req.body.title) {
            return res.status(400).json({ message: 'Title is required' });
        }
        if (!req.body.author) {
            return res.status(400).json({ message: 'Author is required' });
        }
        
        const bookData = {
            title: req.body.title,
            author: req.body.author,
            description: req.body.description || '',
            minAge: req.body.minAge ? Number(req.body.minAge) : undefined,
            category: req.body.category || 'Other',
            status: req.body.status || 'draft',
            bookType: req.body.bookType || 'standard',
            text: req.body.text || '',
            games: req.body.games || [],
            bookGames: req.body.bookGames || [],
            pages: req.body.pages || [],
        };
        if (req.body.featuredCharacterId) {
            const exists = await SavedCharacter.findById(req.body.featuredCharacterId).select('_id').lean();
            if (!exists) return res.status(400).json({ message: 'Invalid featuredCharacterId' });
            bookData.featuredCharacterId = new mongoose.Types.ObjectId(req.body.featuredCharacterId);
        } else {
            bookData.featuredCharacterId = null;
        }
        
        // Always initialize files structure
        bookData.files = {
            coverImage: null,
            images: [],
            videos: [],
            audio: [],
        };
        
        // Handle coverImage - support both old and new structure
        if (req.body.coverImage) {
            bookData.files.coverImage = req.body.coverImage;
        }
        
        // If files object is provided, merge it (but keep arrays initialized)
        if (req.body.files) {
            if (req.body.files.coverImage) {
                bookData.files.coverImage = req.body.files.coverImage;
            }
            if (req.body.files.images) {
                bookData.files.images = req.body.files.images;
            }
            if (req.body.files.videos) {
                bookData.files.videos = req.body.files.videos;
            }
            if (req.body.files.audio) {
                bookData.files.audio = Array.isArray(req.body.files.audio)
                    ? req.body.files.audio.slice(0, 3)
                    : [];
            }
            if (req.body.files.defaultAudioIndex !== undefined) {
                const idx = Math.max(0, Math.min(2, parseInt(req.body.files.defaultAudioIndex, 10) || 0));
                bookData.files.defaultAudioIndex = idx;
            }
        }

        console.log('Book data to save:', JSON.stringify(bookData, null, 2));
        const book = new Book(bookData);
        const newBook = await book.save();
        console.log('Book created successfully:', newBook._id);
        
        // Send notification if book is published (Kids Monthly books are excluded — Create Your Story only)
        if (newBook.status === 'published') {
            notifyNewBook(newBook).catch(err => console.error('Notification error:', err));
        }
        
        // Map coverImage for backward compatibility in response
        const bookObj = newBook.toObject();
        if (bookObj.files && bookObj.files.coverImage) {
            bookObj.coverImage = bookObj.files.coverImage;
        }
        
        res.status(201).json(bookObj);
    } catch (error) {
        console.error('Error creating book:', error);
        console.error('Error details:', error.name, error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        res.status(400).json({ 
            message: error.message, 
            error: error.name,
            details: error.errors || error
        });
    }
});

// PUT update book
router.put('/:id', async (req, res) => {
    try {
        console.log('PUT /api/books/:id - Updating book:', req.params.id);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        // Initialize files object if it doesn't exist
        if (!book.files) {
            book.files = { coverImage: null, images: [], videos: [], audio: [] };
        }

        // Handle files object - ensure proper structure
        if (req.body.files) {
            // If files.coverImage is explicitly provided, use it
            if (req.body.files.coverImage !== undefined) {
                book.files.coverImage = req.body.files.coverImage || null;
                console.log('Updated coverImage from files.coverImage:', book.files.coverImage);
            }
            // Otherwise, if root coverImage is provided, use it
            else if (req.body.coverImage !== undefined) {
                book.files.coverImage = req.body.coverImage || null;
                console.log('Updated coverImage from root coverImage:', book.files.coverImage);
            }
            
            if (req.body.files.images !== undefined) {
                book.files.images = req.body.files.images;
            }
            if (req.body.files.videos !== undefined) {
                book.files.videos = req.body.files.videos;
            }
            if (req.body.files.audio !== undefined) {
                book.files.audio = Array.isArray(req.body.files.audio)
                    ? req.body.files.audio.slice(0, 3)
                    : [];
            }
            if (req.body.files.defaultAudioIndex !== undefined) {
                const idx = Math.max(0, Math.min(2, parseInt(req.body.files.defaultAudioIndex, 10) || 0));
                book.files.defaultAudioIndex = idx;
            }
            delete req.body.files; // Remove from body to avoid duplicate assignment
        }
        // Handle coverImage at root level if files object was not provided
        else if (req.body.coverImage !== undefined) {
            book.files.coverImage = req.body.coverImage || null;
            console.log('Updated coverImage from root (no files object):', book.files.coverImage);
        }
        
        // Remove coverImage from body to avoid duplicate assignment
        delete req.body.coverImage;

        // Handle pages array
        if (req.body.pages !== undefined) {
            book.pages = req.body.pages || [];
            delete req.body.pages; // Remove from body to avoid duplicate assignment
        }

        // Handle bookVideos separately
        if (req.body.bookVideos !== undefined) {
            book.bookVideos = req.body.bookVideos;
            delete req.body.bookVideos;
        }
        
        // Handle bookGames separately
        if (req.body.bookGames !== undefined) {
            book.bookGames = req.body.bookGames;
            delete req.body.bookGames;
        }
        
        // Handle multi-character voice settings
        if (req.body.defaultNarratorVoiceId !== undefined) {
            book.defaultNarratorVoiceId = req.body.defaultNarratorVoiceId || null;
            console.log('🎭 Updated defaultNarratorVoiceId:', book.defaultNarratorVoiceId);
            delete req.body.defaultNarratorVoiceId;
        }
        if (req.body.characterVoices !== undefined) {
            book.characterVoices = req.body.characterVoices || [];
            console.log('🎭 Updated characterVoices:', JSON.stringify(book.characterVoices));
            delete req.body.characterVoices;
        }
        
        if (req.body.featuredCharacterId !== undefined) {
            if (req.body.featuredCharacterId) {
                const exists = await SavedCharacter.findById(req.body.featuredCharacterId).select('_id').lean();
                if (!exists) return res.status(400).json({ message: 'Invalid featuredCharacterId' });
                book.featuredCharacterId = new mongoose.Types.ObjectId(req.body.featuredCharacterId);
            } else {
                book.featuredCharacterId = null;
            }
            delete req.body.featuredCharacterId;
        }
        
        // Update all other fields
        Object.assign(book, req.body);
        
        // Check if status is changing to published
        const wasPublished = book.status === 'published';
        
        console.log('Book before save - files.coverImage:', book.files?.coverImage);
        const updatedBook = await book.save();
        console.log('Book after save - files.coverImage:', updatedBook.files?.coverImage);
        
        // Send notification if book was just published (Kids Monthly excluded — Create Your Story only)
        if (!wasPublished && updatedBook.status === 'published') {
            notifyNewBook(updatedBook).catch(err => console.error('Notification error:', err));
        }
        
        // Map coverImage for backward compatibility in response
        const bookObj = updatedBook.toObject();
        if (bookObj.files && bookObj.files.coverImage) {
            bookObj.coverImage = bookObj.files.coverImage;
        }
        
        console.log('Sending response - coverImage:', bookObj.coverImage);
        res.json(bookObj);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE delete book
router.delete('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        await book.deleteOne();
        res.json({ message: 'Book deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST increment view count (called when a user OPENS a book)
router.post('/:id/view', async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $inc: { viewCount: 1, totalReadSessions: 1 } },
            { new: true }
        );
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        
        console.log(`👁️ Book "${book.title}" viewed - viewCount: ${book.viewCount}`);
        res.json({ 
            viewCount: book.viewCount,
            readCount: book.readCount,
            likeCount: book.likeCount,
            favoriteCount: book.favoriteCount
        });
    } catch (error) {
        console.error('Error incrementing view count:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST increment read count (called when a user COMPLETES reading a book)
router.post('/:id/read', async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $inc: { readCount: 1 } },
            { new: true }
        );
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        
        console.log(`📖 Book "${book.title}" read completed - readCount: ${book.readCount}`);
        res.json({ readCount: book.readCount });
    } catch (error) {
        console.error('Error incrementing read count:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST increment like count
router.post('/:id/like', async (req, res) => {
    try {
        const { action } = req.body; // 'add' or 'remove'
        const increment = action === 'remove' ? -1 : 1;
        
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $inc: { likeCount: increment } },
            { new: true }
        );
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        
        // Ensure count doesn't go negative
        if (book.likeCount < 0) {
            book.likeCount = 0;
            await book.save();
        }
        
        console.log(`👍 Book "${book.title}" like count: ${book.likeCount}`);
        res.json({ likeCount: book.likeCount });
    } catch (error) {
        console.error('Error updating like count:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST increment favorite count
router.post('/:id/favorite', async (req, res) => {
    try {
        const { action } = req.body; // 'add' or 'remove'
        const increment = action === 'remove' ? -1 : 1;
        
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $inc: { favoriteCount: increment } },
            { new: true }
        );
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        
        // Ensure count doesn't go negative
        if (book.favoriteCount < 0) {
            book.favoriteCount = 0;
            await book.save();
        }
        
        console.log(`❤️ Book "${book.title}" favorite count: ${book.favoriteCount}`);
        res.json({ favoriteCount: book.favoriteCount });
    } catch (error) {
        console.error('Error updating favorite count:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
