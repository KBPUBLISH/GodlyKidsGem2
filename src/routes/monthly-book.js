const express = require('express');
const router = express.Router();
const MonthlyBookTemplate = require('../models/MonthlyBookTemplate');
const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const SavedCharacter = require('../models/SavedCharacter');

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
        const { userId, kidId, templateId, childName, childCharacterImageUrl, hasTrialOrPaid } = req.body;

        if (!userId || !kidId || !templateId || !childName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, kidId, templateId, childName',
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
 * GET /api/monthly-book/status/:customMonthlyBookId
 * Check status of a custom book (for polling or deep link).
 */
router.get('/status/:customMonthlyBookId', async (req, res) => {
    try {
        const { customMonthlyBookId } = req.params;
        const custom = await CustomMonthlyBook.findById(customMonthlyBookId)
            .populate('templateId', 'title')
            .populate('bookId', 'title')
            .lean();
        if (!custom) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        res.json({
            success: true,
            status: custom.status,
            bookId: custom.bookId?._id || null,
            title: custom.bookId?.title || custom.templateId?.title,
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
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId required' });
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
                coverImageUrl: b.bookId?.files?.cover?.url || null,
                childName: b.childName,
                createdAt: b.createdAt,
            }));

        res.json({ success: true, books });
    } catch (err) {
        console.error('My monthly books error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
