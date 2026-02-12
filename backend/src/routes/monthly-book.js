const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MonthlyBookTemplate = require('../models/MonthlyBookTemplate');
const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const SavedCharacter = require('../models/SavedCharacter');
const AppUser = require('../models/AppUser');

/**
 * Normalize userId to a MongoDB ObjectId for CustomMonthlyBook (required by schema).
 * If already valid ObjectId, return it; otherwise try to find AppUser by email or deviceId.
 */
async function resolveUserId(userId) {
    if (!userId) return null;
    if (mongoose.Types.ObjectId.isValid(userId) && String(userId).length === 24) {
        return new mongoose.Types.ObjectId(userId);
    }
    const user = await AppUser.findOne({
        $or: [
            { email: userId },
            { deviceId: userId },
        ],
    }).select('_id').lean();
    return user ? user._id : null;
}

/**
 * GET /api/monthly-book/templates
 * List published templates for the app story picker (12 Bible character stories).
 */
router.get('/templates', async (req, res) => {
    try {
        const templates = await MonthlyBookTemplate.find({ status: 'published' })
            .populate('bibleCharacterId', 'internalTag displayName')
            .sort({ order: 1 })
            .lean();

        const list = templates.map((t) => ({
            _id: t._id,
            title: t.title,
            description: t.description,
            bibleCharacter: t.bibleCharacterId
                ? {
                    id: t.bibleCharacterId._id,
                    internalTag: t.bibleCharacterId.internalTag,
                    displayName: t.bibleCharacterId.displayName,
                }
                : null,
            pageCount: (t.storyPages || []).length,
        }));

        res.json({ templates: list });
    } catch (err) {
        console.error('Monthly book templates error:', err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * POST /api/monthly-book/create
 * Create a custom monthly book request; kicks off background generation.
 * Body: userId, kidId, templateId, childName, childCharacterImageUrl?, hasTrialOrPaid?
 */
router.post('/create', async (req, res) => {
    try {
        const { userId: rawUserId, kidId, templateId, childName, childCharacterImageUrl, hasTrialOrPaid } = req.body;

        if (!rawUserId || !kidId || !templateId || !childName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, kidId, templateId, childName',
            });
        }

        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User not found. Sign in or create an account, then try again.',
            });
        }

        const template = await MonthlyBookTemplate.findById(templateId).populate('bibleCharacterId');
        if (!template || template.status !== 'published') {
            return res.status(400).json({ success: false, error: 'Invalid or unpublished template' });
        }

        const customBook = await CustomMonthlyBook.create({
            userId,
            kidId,
            templateId,
            childName: String(childName).trim(),
            childCharacterImageUrl: childCharacterImageUrl || null,
            hasTrialOrPaid: Boolean(hasTrialOrPaid),
            status: 'pending',
        });

        // Kick off generation (async; don't await)
        const { runMonthlyBookGeneration } = require('../jobs/monthlyBookGenerator');
        runMonthlyBookGeneration(customBook._id).catch((err) => {
            console.error('Monthly book generation error:', err);
        });

        res.status(202).json({
            success: true,
            customMonthlyBookId: customBook._id,
            message: 'Your story is being created. We will notify you when it is ready.',
        });
    } catch (err) {
        console.error('Monthly book create error:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to create monthly book' });
    }
});

/**
 * POST /api/monthly-book/create-from-book
 * Create a custom monthly book from a Book Builder book (bookType kids_monthly).
 * Body: userId, kidId, bookId, childName, childCharacterImageUrl?, hasTrialOrPaid?
 */
router.post('/create-from-book', async (req, res) => {
    try {
        const { userId: rawUserId, kidId, bookId: sourceBookId, childName, childCharacterImageUrl, hasTrialOrPaid } = req.body;

        if (!rawUserId || !kidId || !sourceBookId || !childName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, kidId, bookId, childName',
            });
        }

        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User not found. Sign in or create an account, then try again.',
            });
        }

        const Book = require('../models/Book');
        const sourceBook = await Book.findById(sourceBookId).populate('featuredCharacterId').lean();
        if (!sourceBook || sourceBook.bookType !== 'kids_monthly' || sourceBook.status !== 'published') {
            return res.status(400).json({
                success: false,
                error: 'Invalid or unpublished Kids Monthly book',
            });
        }

        const customBook = await CustomMonthlyBook.create({
            userId,
            kidId,
            sourceBookId: new mongoose.Types.ObjectId(sourceBookId),
            childName: String(childName).trim(),
            childCharacterImageUrl: childCharacterImageUrl || null,
            hasTrialOrPaid: Boolean(hasTrialOrPaid),
            status: 'pending',
        });

        const { runMonthlyBookGeneration } = require('../jobs/monthlyBookGenerator');
        runMonthlyBookGeneration(customBook._id).catch((err) => {
            console.error('Monthly book generation error:', err);
        });

        res.status(202).json({
            success: true,
            customMonthlyBookId: customBook._id,
            message: 'Your story is being created. We will notify you when it is ready.',
        });
    } catch (err) {
        console.error('Monthly book create-from-book error:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to create monthly book' });
    }
});

/**
 * GET /api/monthly-book/status/:customMonthlyBookId
 * Check status of a custom book (for polling or deep link).
 */
router.get('/status/:customMonthlyBookId', async (req, res) => {
    try {
        const { customMonthlyBookId } = req.params;
        const custom = await CustomMonthlyBook.findById(customMonthlyBookId)
            .populate('templateId', 'title')
            .populate('bookId', 'title')
            .populate('sourceBookId', 'title')
            .lean();
        if (!custom) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        const title = custom.bookId?.title || custom.templateId?.title || custom.sourceBookId?.title;
        res.json({
            success: true,
            status: custom.status,
            bookId: custom.bookId?._id || null,
            title: title || null,
        });
    } catch (err) {
        console.error('Monthly book status error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/monthly-book/my-books
 * List completed custom books for a user (for My Library).
 * Query: userId (required)
 */
router.get('/my-books', async (req, res) => {
    try {
        const { userId: rawUserId } = req.query;
        if (!rawUserId) {
            return res.status(400).json({ success: false, error: 'userId required' });
        }
        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return res.json({ success: true, books: [] });
        }
        const list = await CustomMonthlyBook.find({ userId, status: 'completed' })
            .populate('bookId', 'title files')
            .populate('templateId', 'title')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const books = list
            .filter((b) => b.bookId)
            .map((b) => ({
                customMonthlyBookId: b._id,
                bookId: b.bookId._id,
                title: b.bookId.title,
                coverImageUrl: b.bookId?.files?.coverImage || b.bookId?.files?.cover?.url || null,
                childName: b.childName,
                createdAt: b.createdAt,
            }));

        res.json({ success: true, books });
    } catch (err) {
        console.error('My monthly books error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------- Portal admin (all templates, CRUD) ----------

/**
 * GET /api/monthly-book/admin/templates
 * List all templates (any status) for portal.
 */
router.get('/admin/templates', async (req, res) => {
    try {
        const templates = await MonthlyBookTemplate.find()
            .populate('bibleCharacterId', 'internalTag displayName')
            .sort({ order: 1, createdAt: -1 })
            .lean();

        const list = templates.map((t) => ({
            _id: t._id,
            title: t.title,
            description: t.description,
            bibleCharacterId: t.bibleCharacterId?._id,
            bibleCharacter: t.bibleCharacterId
                ? { internalTag: t.bibleCharacterId.internalTag, displayName: t.bibleCharacterId.displayName }
                : null,
            storyPages: t.storyPages || [],
            order: t.order,
            status: t.status,
            createdAt: t.createdAt,
        }));

        res.json({ templates: list });
    } catch (err) {
        console.error('Admin monthly book templates error:', err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * GET /api/monthly-book/admin/characters
 * List saved characters. Query ?status=all for all statuses; otherwise default active only (for dropdown).
 */
router.get('/admin/characters', async (req, res) => {
    try {
        const filter = req.query.status === 'all' ? {} : { status: 'active' };
        const characters = await SavedCharacter.find(filter)
            .sort({ order: 1, createdAt: 1 })
            .select('_id internalTag displayName styleId order status scriptureReference referenceImageUrl stylePrompt')
            .lean();
        res.json({ characters });
    } catch (err) {
        console.error('Admin characters error:', err);
        res.status(500).json({ error: 'Failed to fetch characters' });
    }
});

/**
 * GET /api/monthly-book/admin/characters/:id
 * Get one saved character for portal edit.
 */
router.get('/admin/characters/:id', async (req, res) => {
    try {
        const char = await SavedCharacter.findById(req.params.id).lean();
        if (!char) return res.status(404).json({ error: 'Character not found' });
        res.json(char);
    } catch (err) {
        console.error('Admin get character error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/monthly-book/admin/characters
 * Create a saved character (portal).
 */
router.post('/admin/characters', async (req, res) => {
    try {
        const { internalTag, displayName, scriptureReference, styleId, stylePrompt, referenceImageUrl, order, status } = req.body;
        if (!internalTag || !displayName) {
            return res.status(400).json({ error: 'internalTag and displayName are required' });
        }
        const character = await SavedCharacter.create({
            internalTag: String(internalTag).trim(),
            displayName: String(displayName).trim(),
            scriptureReference: scriptureReference ? String(scriptureReference).trim() : undefined,
            styleId: styleId || undefined,
            stylePrompt: stylePrompt != null ? String(stylePrompt).trim() : '',
            referenceImageUrl: referenceImageUrl || undefined,
            order: order != null ? Number(order) : 0,
            status: status || 'active',
        });
        res.status(201).json(character);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: 'A character with this internal tag already exists' });
        console.error('Admin create character error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/monthly-book/admin/characters/:id
 * Update a saved character (portal).
 */
router.put('/admin/characters/:id', async (req, res) => {
    try {
        const { internalTag, displayName, scriptureReference, styleId, stylePrompt, referenceImageUrl, order, status } = req.body;
        const update = {};
        if (internalTag !== undefined) update.internalTag = String(internalTag).trim();
        if (displayName !== undefined) update.displayName = String(displayName).trim();
        if (scriptureReference !== undefined) update.scriptureReference = scriptureReference ? String(scriptureReference).trim() : '';
        if (styleId !== undefined) update.styleId = styleId || null;
        if (stylePrompt !== undefined) update.stylePrompt = String(stylePrompt).trim();
        if (referenceImageUrl !== undefined) update.referenceImageUrl = referenceImageUrl || null;
        if (order !== undefined) update.order = Number(order);
        if (status !== undefined) update.status = status;

        const character = await SavedCharacter.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).lean();
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json(character);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: 'A character with this internal tag already exists' });
        console.error('Admin update character error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/monthly-book/admin/characters/:id
 * Delete a saved character (portal). Hard delete.
 */
router.delete('/admin/characters/:id', async (req, res) => {
    try {
        const character = await SavedCharacter.findByIdAndDelete(req.params.id);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('Admin delete character error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monthly-book/admin/templates/:id
 * Get one template for portal edit.
 */
router.get('/admin/templates/:id', async (req, res) => {
    try {
        const t = await MonthlyBookTemplate.findById(req.params.id)
            .populate('bibleCharacterId', 'internalTag displayName')
            .lean();
        if (!t) return res.status(404).json({ error: 'Template not found' });
        res.json(t);
    } catch (err) {
        console.error('Admin get template error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/monthly-book/admin/templates
 * Create a template (portal).
 */
router.post('/admin/templates', async (req, res) => {
    try {
        const { title, description, bibleCharacterId, storyPages, order, status } = req.body;
        if (!title || !bibleCharacterId) {
            return res.status(400).json({ error: 'title and bibleCharacterId are required' });
        }
        const template = await MonthlyBookTemplate.create({
            title,
            description: description || '',
            bibleCharacterId,
            storyPages: Array.isArray(storyPages) ? storyPages : [],
            order: order != null ? order : 0,
            status: status || 'draft',
        });
        res.status(201).json(template);
    } catch (err) {
        console.error('Admin create template error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/monthly-book/admin/templates/:id
 * Update a template (portal).
 */
router.put('/admin/templates/:id', async (req, res) => {
    try {
        const { title, description, bibleCharacterId, storyPages, order, status } = req.body;
        const update = {};
        if (title !== undefined) update.title = title;
        if (description !== undefined) update.description = description;
        if (bibleCharacterId !== undefined) update.bibleCharacterId = bibleCharacterId;
        if (Array.isArray(storyPages)) update.storyPages = storyPages;
        if (order !== undefined) update.order = order;
        if (status !== undefined) update.status = status;

        const template = await MonthlyBookTemplate.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).populate('bibleCharacterId', 'internalTag displayName');

        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (err) {
        console.error('Admin update template error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/monthly-book/admin/templates/:id
 * Delete a template (portal).
 */
router.delete('/admin/templates/:id', async (req, res) => {
    try {
        const template = await MonthlyBookTemplate.findByIdAndDelete(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('Admin delete template error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
