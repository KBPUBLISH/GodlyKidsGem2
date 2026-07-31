const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();
const MapIsland = require('../models/MapIsland');
const MapStory = require('../models/MapStory');
const Book = require('../models/Book');
const Page = require('../models/Page');
const { segmentLineArt, DEFAULT_PALETTE } = require('../services/coloringRegionService');
const { bucket } = require('../config/storage');

function dbUnavailableResponse(res) {
    return res.status(503).json({
        error: 'Database unavailable. Check MONGO_URI and that MongoDB is running.',
    });
}

const coloringUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadsDir = path.join(__dirname, '../../uploads');

async function storeColoringBuffer(buffer, filePath, contentType, req) {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const gcsReady =
        !!bucket &&
        !!bucketName &&
        !/your-bucket-name/i.test(bucketName) &&
        !bucketName.includes('<');

    if (gcsReady) {
        try {
            await new Promise((resolve, reject) => {
                const blob = bucket.file(filePath);
                const stream = blob.createWriteStream({
                    metadata: { contentType },
                    resumable: false,
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(buffer);
            });
            return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        } catch (err) {
            console.warn(
                'GCS coloring upload failed, falling back to local storage:',
                err?.message || err,
            );
        }
    }

    const localPath = path.join(uploadsDir, filePath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
    const protocol = req?.protocol || 'http';
    const host = req?.get?.('host') || `localhost:${process.env.PORT || 5001}`;
    return `${protocol}://${host}/uploads/${filePath}`;
}

const COLORING_PAGE_SELECT =
    'pageNumber isColoringPage coloringEndModalOnly bookId backgroundUrl files.background tapFill';

const DEFAULT_ISLANDS = [
    { slug: 'genesis', title: 'Genesis', bookLabel: 'Genesis', description: 'Creation', order: 0, unlockRule: 'always', mapPosition: { x: 50, y: 3.5 } },
    { slug: 'exodus', title: 'Exodus', bookLabel: 'Exodus', description: 'God Rescues', order: 1, unlockRule: 'previous_complete', mapPosition: { x: 47, y: 30 } },
    { slug: 'daniel', title: 'Daniel', bookLabel: 'Daniel', description: 'Faithful in Exile', order: 2, unlockRule: 'previous_complete', mapPosition: { x: 27, y: 49 } },
    { slug: 'joshua', title: 'Joshua', bookLabel: 'Joshua', description: 'Promised Land', order: 3, unlockRule: 'previous_complete', mapPosition: { x: 65, y: 67 } },
    { slug: '1-samuel', title: '1 Samuel', bookLabel: '1 Samuel', description: 'A King is Chosen', order: 4, unlockRule: 'previous_complete', mapPosition: { x: 36, y: 86 } },
];

function populateStory(query) {
    return query
        .populate('islandId', 'slug title bookLabel order status')
        .populate('bookId', 'title status bookType files.coverImage coverImage author')
        .populate('coloringPageIds', COLORING_PAGE_SELECT);
}

// ─── Seed defaults (portal) ───────────────────────────────────────────────

/**
 * POST /api/bible-map/seed-defaults
 * Creates default islands if the collection is empty (idempotent).
 */
router.post('/seed-defaults', async (req, res) => {
    try {
        const count = await MapIsland.countDocuments();
        if (count > 0) {
            const islands = await MapIsland.find().sort({ order: 1 });
            return res.json({ seeded: false, message: 'Islands already exist', islands });
        }
        const islands = await MapIsland.insertMany(
            DEFAULT_ISLANDS.map((i) => ({ ...i, status: 'draft' })),
        );
        res.status(201).json({ seeded: true, islands });
    } catch (error) {
        console.error('Error seeding bible map islands:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Islands ──────────────────────────────────────────────────────────────

/**
 * GET /api/bible-map/islands
 * Query: status=all|draft|published|archived (default published for app; portal uses all)
 */
router.get('/islands', async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status === 'all') {
            // no status filter
        } else if (status) {
            filter.status = status;
        } else {
            filter.status = 'published';
        }

        const islands = await MapIsland.find(filter).sort({ order: 1, createdAt: 1 }).lean();

        // Attach story counts
        const islandIds = islands.map((i) => i._id);
        const counts = await MapStory.aggregate([
            { $match: { islandId: { $in: islandIds } } },
            {
                $group: {
                    _id: '$islandId',
                    total: { $sum: 1 },
                    published: {
                        $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] },
                    },
                },
            },
        ]);
        const countMap = Object.fromEntries(
            counts.map((c) => [String(c._id), { total: c.total, published: c.published }]),
        );

        const withCounts = islands.map((island) => ({
            ...island,
            storyCounts: countMap[String(island._id)] || { total: 0, published: 0 },
        }));

        res.json(withCounts);
    } catch (error) {
        console.error('Error fetching map islands:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/bible-map/islands/:idOrSlug
 */
router.get('/islands/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const island = mongooseIsObjectId(idOrSlug)
            ? await MapIsland.findById(idOrSlug)
            : await MapIsland.findOne({ slug: idOrSlug.toLowerCase() });

        if (!island) {
            return res.status(404).json({ error: 'Island not found' });
        }

        const stories = await populateStory(
            MapStory.find({ islandId: island._id }).sort({ order: 1 }),
        );

        const readiness = buildIslandLaunchReadiness(island, stories);

        res.json({ island, stories, readiness });
    } catch (error) {
        console.error('Error fetching map island:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/islands/:id/launch
 * Publishes the island + all its story packs when checklist passes.
 * Body: { force?: boolean } — force launch despite soft warnings (not hard blockers).
 */
router.post('/islands/:id/launch', async (req, res) => {
    try {
        const island = await MapIsland.findById(req.params.id);
        if (!island) {
            return res.status(404).json({ error: 'Island not found' });
        }

        const stories = await MapStory.find({ islandId: island._id }).sort({ order: 1 });
        const readiness = buildIslandLaunchReadiness(island, stories);
        const force = !!req.body?.force;

        if (readiness.blockers.length > 0) {
            return res.status(400).json({
                error: 'Island is not ready to launch',
                readiness,
            });
        }
        if (readiness.warnings.length > 0 && !force) {
            return res.status(400).json({
                error: 'Island has launch warnings — pass force:true to launch anyway',
                readiness,
                needsForce: true,
            });
        }

        island.status = 'published';
        await island.save();

        await MapStory.updateMany(
            { islandId: island._id },
            { $set: { status: 'published' } },
        );

        // Publish linked bible_map books so they are usable when the app wires up
        const bookIds = stories.map((s) => s.bookId).filter(Boolean);
        if (bookIds.length > 0) {
            await Book.updateMany(
                { _id: { $in: bookIds }, bookType: 'bible_map' },
                { $set: { status: 'published' } },
            );
        }

        const refreshedStories = await populateStory(
            MapStory.find({ islandId: island._id }).sort({ order: 1 }),
        );

        res.json({
            success: true,
            message: 'Island launched (published)',
            island,
            stories: refreshedStories,
            readiness: buildIslandLaunchReadiness(island, refreshedStories),
        });
    } catch (error) {
        console.error('Error launching map island:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/islands/:id/unpublish
 * Takes island (and optionally stories) back to draft for content work.
 */
router.post('/islands/:id/unpublish', async (req, res) => {
    try {
        const island = await MapIsland.findById(req.params.id);
        if (!island) {
            return res.status(404).json({ error: 'Island not found' });
        }
        island.status = 'draft';
        await island.save();

        if (req.body?.unpublishStories !== false) {
            await MapStory.updateMany(
                { islandId: island._id },
                { $set: { status: 'draft' } },
            );
        }

        res.json({ success: true, island });
    } catch (error) {
        console.error('Error unpublishing map island:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/islands
 */
router.post('/islands', async (req, res) => {
    try {
        const payload = sanitizeIslandPayload(req.body);
        if (!payload.slug || !payload.title) {
            return res.status(400).json({ error: 'slug and title are required' });
        }
        const existing = await MapIsland.findOne({ slug: payload.slug });
        if (existing) {
            return res.status(400).json({ error: `Island slug "${payload.slug}" already exists` });
        }
        if (payload.order == null) {
            const max = await MapIsland.findOne().sort({ order: -1 }).select('order').lean();
            payload.order = (max?.order ?? -1) + 1;
        }
        if (!payload.status) payload.status = 'draft';
        const island = await MapIsland.create(payload);
        res.status(201).json(island);
    } catch (error) {
        console.error('Error creating map island:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/bible-map/islands/:id
 */
router.put('/islands/:id', async (req, res) => {
    try {
        const payload = sanitizeIslandPayload(req.body);
        if (payload.slug) {
            const clash = await MapIsland.findOne({
                slug: payload.slug,
                _id: { $ne: req.params.id },
            });
            if (clash) {
                return res.status(400).json({ error: `Island slug "${payload.slug}" already exists` });
            }
        }
        const island = await MapIsland.findByIdAndUpdate(req.params.id, payload, {
            new: true,
            runValidators: true,
        });
        if (!island) {
            return res.status(404).json({ error: 'Island not found' });
        }
        res.json(island);
    } catch (error) {
        console.error('Error updating map island:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/bible-map/islands/:id
 * Also deletes stories on that island.
 */
router.delete('/islands/:id', async (req, res) => {
    try {
        const island = await MapIsland.findByIdAndDelete(req.params.id);
        if (!island) {
            return res.status(404).json({ error: 'Island not found' });
        }
        await MapStory.deleteMany({ islandId: island._id });
        res.json({ success: true, deletedIslandId: island._id });
    } catch (error) {
        console.error('Error deleting map island:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Stories ──────────────────────────────────────────────────────────────

/**
 * GET /api/bible-map/stories
 * Query: islandId, status=all|…
 */
router.get('/stories', async (req, res) => {
    try {
        const filter = {};
        if (req.query.islandId) filter.islandId = req.query.islandId;
        if (req.query.status === 'all') {
            // no filter
        } else if (req.query.status) {
            filter.status = req.query.status;
        } else {
            filter.status = 'published';
        }

        const stories = await populateStory(
            MapStory.find(filter).sort({ order: 1, createdAt: -1 }),
        );
        res.json(stories);
    } catch (error) {
        console.error('Error fetching map stories:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/bible-map/stories/:id
 */
router.get('/stories/:id', async (req, res) => {
    try {
        const story = await populateStory(MapStory.findById(req.params.id));
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const byId = new Map();

        // Pages already attached to the pack (may be standalone, no bookId)
        for (const p of story.coloringPageIds || []) {
            if (p && typeof p === 'object' && p._id) {
                byId.set(String(p._id), typeof p.toObject === 'function' ? p.toObject() : p);
            }
        }

        // Plus all coloring pages on the linked book (for pick-list in portal)
        if (story.bookId) {
            const bookPages = await Page.find({
                bookId: story.bookId._id || story.bookId,
                isColoringPage: true,
            })
                .select(COLORING_PAGE_SELECT)
                .sort({ pageNumber: 1 })
                .lean();
            for (const p of bookPages) {
                byId.set(String(p._id), p);
            }
        }

        const coloringPages = Array.from(byId.values()).sort(
            (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0),
        );

        res.json({ story, coloringPages });
    } catch (error) {
        console.error('Error fetching map story:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/coloring/preprocess
 * Upload clean line-art → binarize + CCL → create coloring Page with tapFill region map.
 * multipart field: file
 * body/query: bookId (optional — omit for standalone bible-map coloring pages),
 *             palette (optional JSON array or comma-separated)
 */
router.post(
    '/coloring/preprocess',
    coloringUpload.single('file'),
    async (req, res) => {
        try {
            if (mongoose.connection.readyState !== 1) {
                return dbUnavailableResponse(res);
            }
            const bookId = req.body.bookId || req.query.bookId || null;
            if (!req.file?.buffer) {
                return res.status(400).json({ error: 'Image file is required' });
            }
            if (bookId) {
                const book = await Book.findById(bookId);
                if (!book) {
                    return res.status(404).json({ error: 'Book not found' });
                }
            }

            let palette;
            const rawPalette = req.body.palette || req.query.palette;
            if (rawPalette) {
                try {
                    palette = typeof rawPalette === 'string' && rawPalette.trim().startsWith('[')
                        ? JSON.parse(rawPalette)
                        : String(rawPalette)
                              .split(',')
                              .map((c) => c.trim())
                              .filter(Boolean);
                } catch {
                    palette = undefined;
                }
            }

            const segmented = await segmentLineArt(req.file.buffer, { palette });
            if (segmented.regionCount < 1) {
                return res.status(400).json({
                    error:
                        'No fillable regions found. Use closed black outlines with white interiors.',
                });
            }

            const ts = Date.now();
            const base = bookId
                ? `books/${bookId}/coloring/${ts}`
                : `bible-map/coloring/${ts}`;
            const [lineArtUrl, regionMapUrl, regionPreviewUrl] = await Promise.all([
                storeColoringBuffer(
                    segmented.lineArtPng,
                    `${base}-lineart.png`,
                    'image/png',
                    req,
                ),
                storeColoringBuffer(
                    segmented.regionMapPng,
                    `${base}-regions.png`,
                    'image/png',
                    req,
                ),
                storeColoringBuffer(
                    segmented.regionPreviewPng,
                    `${base}-preview.png`,
                    'image/png',
                    req,
                ),
            ]);

            let pageNumber;
            if (bookId) {
                const last = await Page.findOne({ bookId })
                    .sort({ pageNumber: -1 })
                    .select('pageNumber')
                    .lean();
                pageNumber = (last?.pageNumber ?? 0) + 1;
            } else {
                // Standalone pack coloring — unique pageNumber without a Book
                const last = await Page.findOne({
                    bookId: null,
                    isColoringPage: true,
                })
                    .sort({ pageNumber: -1 })
                    .select('pageNumber')
                    .lean();
                pageNumber = Math.max(last?.pageNumber ?? 0, Math.floor(ts / 1000)) + 1;
            }

            const page = await Page.create({
                ...(bookId ? { bookId } : {}),
                pageNumber,
                isColoringPage: true,
                coloringEndModalOnly: true,
                backgroundUrl: lineArtUrl,
                backgroundType: 'image',
                files: {
                    background: { url: lineArtUrl, type: 'image' },
                },
                tapFill: {
                    enabled: true,
                    regionMapUrl,
                    regionPreviewUrl,
                    regionCount: segmented.regionCount,
                    width: segmented.width,
                    height: segmented.height,
                    palette: segmented.palette?.length
                        ? segmented.palette
                        : DEFAULT_PALETTE.slice(),
                    minRegionArea: segmented.minRegionArea,
                },
            });

            res.status(201).json({
                page,
                regionCount: segmented.regionCount,
                width: segmented.width,
                height: segmented.height,
                lineArtUrl,
                regionMapUrl,
                regionPreviewUrl,
                palette: page.tapFill.palette,
            });
        } catch (error) {
            console.error('Coloring preprocess error:', error);
            const msg = error?.message || '';
            if (
                mongoose.connection.readyState !== 1 ||
                /buffering timed out|ECONNREFUSED|MongoNetworkError|MongoServerSelectionError/i.test(
                    msg,
                )
            ) {
                return dbUnavailableResponse(res);
            }
            res.status(500).json({ error: msg || 'Coloring preprocess failed' });
        }
    },
);

/**
 * PATCH /api/bible-map/coloring/pages/:pageId
 * Update tap-fill palette (and optional enabled flag) on an existing coloring page.
 */
router.patch('/coloring/pages/:pageId', async (req, res) => {
    try {
        const page = await Page.findById(req.params.pageId);
        if (!page) return res.status(404).json({ error: 'Page not found' });
        if (!page.isColoringPage) {
            return res.status(400).json({ error: 'Page is not a coloring page' });
        }

        if (!page.tapFill) page.tapFill = {};
        if (Array.isArray(req.body.palette)) {
            page.tapFill.palette = req.body.palette
                .map((c) => String(c).trim())
                .filter(Boolean);
        }
        if (typeof req.body.enabled === 'boolean') {
            page.tapFill.enabled = req.body.enabled;
        }
        page.markModified('tapFill');
        await page.save();
        res.json({ page });
    } catch (error) {
        console.error('Coloring page update error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/stories
 */
router.post('/stories', async (req, res) => {
    try {
        const payload = sanitizeStoryPayload(req.body);
        if (!payload.islandId || !payload.title) {
            return res.status(400).json({ error: 'islandId and title are required' });
        }
        const island = await MapIsland.findById(payload.islandId);
        if (!island) {
            return res.status(400).json({ error: 'Island not found' });
        }
        if (payload.order == null) {
            const max = await MapStory.findOne({ islandId: payload.islandId })
                .sort({ order: -1 })
                .select('order')
                .lean();
            payload.order = (max?.order ?? 0) + 1;
        }
        if (!payload.displayTitle) {
            payload.displayTitle = `${payload.order}. ${String(payload.title).toUpperCase()}`;
        }

        if (payload.bookId) {
            const book = await Book.findById(payload.bookId);
            if (!book) return res.status(400).json({ error: 'Book not found' });
        }

        const story = await MapStory.create(payload);
        const populated = await populateStory(MapStory.findById(story._id));
        res.status(201).json(populated);
    } catch (error) {
        console.error('Error creating map story:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/bible-map/stories/:id
 */
router.put('/stories/:id', async (req, res) => {
    try {
        const payload = sanitizeStoryPayload(req.body);

        if (payload.bookId) {
            const book = await Book.findById(payload.bookId);
            if (!book) return res.status(400).json({ error: 'Book not found' });
        }

        if (payload.islandId) {
            const island = await MapIsland.findById(payload.islandId);
            if (!island) return res.status(400).json({ error: 'Island not found' });
        }

        const story = await MapStory.findByIdAndUpdate(req.params.id, payload, {
            new: true,
            runValidators: true,
        });
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const populated = await populateStory(MapStory.findById(story._id));
        res.json(populated);
    } catch (error) {
        console.error('Error updating map story:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/bible-map/stories/:id
 */
router.delete('/stories/:id', async (req, res) => {
    try {
        const story = await MapStory.findByIdAndDelete(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json({ success: true, deletedStoryId: story._id });
    } catch (error) {
        console.error('Error deleting map story:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/bible-map/stories/:id/create-book
 * Creates a draft bible_map Book and links it to this story.
 */
router.post('/stories/:id/create-book', async (req, res) => {
    try {
        const story = await MapStory.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        if (story.bookId) {
            return res.status(400).json({
                error: 'Story already has a linked book',
                bookId: story.bookId,
            });
        }

        const island = await MapIsland.findById(story.islandId);
        const title = req.body.title || story.title;
        const author = req.body.author || 'Godly Kids';

        const book = await Book.create({
            title,
            author,
            description: req.body.description || story.verse || '',
            status: 'draft',
            bookType: 'bible_map',
            orientation: 'portrait',
            readerLayout: 'side_swipe',
            category: island?.bookLabel || island?.title || 'Bible Map',
            categories: ['Bible Map', island?.title].filter(Boolean),
        });

        story.bookId = book._id;
        await story.save();

        const populated = await populateStory(MapStory.findById(story._id));
        res.status(201).json({ story: populated, book });
    } catch (error) {
        console.error('Error creating bible map book for story:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function mongooseIsObjectId(value) {
    return /^[a-fA-F0-9]{24}$/.test(String(value));
}

function sanitizeIslandPayload(body = {}) {
    const allowed = [
        'slug',
        'title',
        'bookLabel',
        'description',
        'mapArtUrl',
        'sailArtUrl',
        'mapPosition',
        'order',
        'status',
        'unlockRule',
        'introVideoUrl',
        'sceneBgVideoUrl',
    ];
    const out = {};
    for (const key of allowed) {
        if (body[key] !== undefined) out[key] = body[key];
    }
    if (out.slug) out.slug = String(out.slug).trim().toLowerCase();
    return out;
}

const QUIZ_LEVELS = ['easy', 'medium', 'hard'];

function normalizeQuizQuestion(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const question = String(raw.question || '').trim();
    if (!question) return null;
    let options = Array.isArray(raw.options)
        ? raw.options.map((o) => String(o ?? '').trim())
        : [];
    while (options.length < 4) options.push('');
    options = options.slice(0, 4);
    let correctIndex = Number(raw.correctIndex);
    if (!Number.isFinite(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        correctIndex = 0;
    }
    const explanation = String(raw.explanation || '').trim();
    return {
        question,
        options,
        correctIndex,
        ...(explanation ? { explanation } : {}),
    };
}

function normalizeQuizLevels(levels = {}, fallbackQuestions = []) {
    const out = { easy: [], medium: [], hard: [] };
    for (const level of QUIZ_LEVELS) {
        const list = Array.isArray(levels?.[level]) ? levels[level] : [];
        out[level] = list.map(normalizeQuizQuestion).filter(Boolean);
    }
    if (
        out.easy.length === 0 &&
        out.medium.length === 0 &&
        out.hard.length === 0 &&
        Array.isArray(fallbackQuestions) &&
        fallbackQuestions.length > 0
    ) {
        out.easy = fallbackQuestions.map(normalizeQuizQuestion).filter(Boolean);
    }
    return out;
}

function countQuizQuestions(levels) {
    if (!levels) return 0;
    return QUIZ_LEVELS.reduce(
        (n, level) => n + (Array.isArray(levels[level]) ? levels[level].length : 0),
        0,
    );
}

function storyHasQuizContent(story) {
    if (!story || story.quizMode === 'none') return false;
    if (story.quizMode === 'book_quiz') {
        return !!(story.bookId?._id || story.bookId);
    }
    if (story.quizMode === 'custom') {
        const levels = story.quiz?.levels;
        if (countQuizQuestions(levels) > 0) return true;
        return Array.isArray(story.customQuestions) && story.customQuestions.length > 0;
    }
    return false;
}

const SCENE_ACTIVITY_IDS = ['read', 'quiz', 'puzzle', 'coloring', 'game'];
const SCENE_LOCK_MODES = ['always', 'content', 'trigger'];
const SCENE_AFTER = ['navigate', 'stay'];

function clampPercent(n, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(100, Math.max(0, v));
}

function normalizeSceneButton(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const lockedUntil = SCENE_LOCK_MODES.includes(raw.lockedUntil)
        ? raw.lockedUntil
        : 'content';
    const iconUrl = String(raw.iconUrl || '').trim();
    const label = String(raw.label || '').trim();
    return {
        id,
        x: clampPercent(raw.x, 10),
        y: clampPercent(raw.y, 70),
        w: clampPercent(raw.w, 14),
        h: clampPercent(raw.h, 12),
        ...(iconUrl ? { iconUrl } : {}),
        ...(label ? { label } : {}),
        lockedUntil,
    };
}

function normalizeSceneDeviceLayout(raw) {
    if (!raw || typeof raw !== 'object') {
        return { showActivitiesBoard: true, buttons: [] };
    }
    const buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
        .map(normalizeSceneButton)
        .filter(Boolean);
    return {
        showActivitiesBoard: raw.showActivitiesBoard !== false,
        buttons,
    };
}

function normalizeSceneLayout(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            phone: { showActivitiesBoard: true, buttons: [] },
            tablet: { showActivitiesBoard: true, buttons: [] },
        };
    }
    return {
        phone: normalizeSceneDeviceLayout(raw.phone),
        tablet: normalizeSceneDeviceLayout(raw.tablet),
    };
}

function normalizeSceneAnimation(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    const videoUrl = String(raw.videoUrl || '').trim();
    if (!id || !videoUrl) return null;
    return {
        id,
        label: String(raw.label || '').trim(),
        videoUrl,
    };
}

function normalizeSceneTrigger(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    const fromButtonId = String(raw.fromButtonId || '').trim();
    if (!id || !fromButtonId) return null;
    const after = SCENE_AFTER.includes(raw.after) ? raw.after : 'navigate';
    let navigateTo = String(raw.navigateTo || '').trim();
    if (navigateTo && !SCENE_ACTIVITY_IDS.includes(navigateTo)) navigateTo = '';
    return {
        id,
        fromButtonId,
        animationId: String(raw.animationId || '').trim(),
        after,
        navigateTo,
    };
}

function sanitizeStoryPayload(body = {}) {
    const allowed = [
        'islandId',
        'order',
        'title',
        'displayTitle',
        'scriptureRef',
        'verse',
        'verseRef',
        'heroImageUrl',
        'introVideoUrl',
        'sceneBgVideoUrl',
        'sceneMusicUrl',
        'status',
        'bookId',
        'quizMode',
        'customQuestions',
        'quiz',
        'coloringPageIds',
        'puzzle',
        'game',
        'unlockOrder',
        'sceneLayout',
        'sceneAnimations',
        'sceneTriggers',
    ];
    const out = {};
    for (const key of allowed) {
        if (body[key] !== undefined) out[key] = body[key];
    }
    // Allow clearing book link / scene music
    if (body.bookId === null || body.bookId === '') out.bookId = null;
    if (body.sceneMusicUrl === null || body.sceneMusicUrl === '') out.sceneMusicUrl = null;

    // Normalize leveled quiz + keep customQuestions synced to easy for legacy readers
    if (body.quiz !== undefined || body.customQuestions !== undefined) {
        const levels = normalizeQuizLevels(
            body.quiz?.levels || {},
            body.customQuestions || [],
        );
        const defaultLevel = QUIZ_LEVELS.includes(body.quiz?.defaultLevel)
            ? body.quiz.defaultLevel
            : 'easy';
        out.quiz = { defaultLevel, levels };
        out.customQuestions = levels.easy;
    }

    if (body.sceneLayout !== undefined) {
        out.sceneLayout = normalizeSceneLayout(body.sceneLayout);
    }
    if (body.sceneAnimations !== undefined) {
        out.sceneAnimations = (Array.isArray(body.sceneAnimations)
            ? body.sceneAnimations
            : []
        )
            .map(normalizeSceneAnimation)
            .filter(Boolean);
    }
    if (body.sceneTriggers !== undefined) {
        out.sceneTriggers = (Array.isArray(body.sceneTriggers)
            ? body.sceneTriggers
            : []
        )
            .map(normalizeSceneTrigger)
            .filter(Boolean);
    }

    return out;
}

/**
 * Checklist for launching an island into "published" CMS state.
 * (App still uses hardcoded map until wired — Launch prepares content only.)
 */
function buildIslandLaunchReadiness(island, stories = []) {
    const blockers = [];
    const warnings = [];
    const checklist = [];

    const hasTitle = !!(island.title && String(island.title).trim());
    const hasSlug = !!(island.slug && String(island.slug).trim());
    const hasMapArt = !!(island.mapArtUrl && String(island.mapArtUrl).trim());
    const hasSailArt = !!(island.sailArtUrl && String(island.sailArtUrl).trim());
    const storyList = Array.isArray(stories) ? stories : [];

    checklist.push({ id: 'title', label: 'Island name', ok: hasTitle });
    checklist.push({ id: 'slug', label: 'Slug / route', ok: hasSlug });
    checklist.push({ id: 'mapArt', label: 'Map island image', ok: hasMapArt });
    checklist.push({
        id: 'sailArt',
        label: 'Sail carousel image',
        ok: hasSailArt || hasMapArt,
    });
    checklist.push({
        id: 'stories',
        label: 'At least one story pack',
        ok: storyList.length > 0,
    });

    if (!hasTitle) blockers.push('Add an island name');
    if (!hasSlug) blockers.push('Add a slug (app route id)');
    if (!hasMapArt) blockers.push('Upload a map island image');
    if (storyList.length === 0) blockers.push('Add at least one story pack');

    if (!hasSailArt && hasMapArt) {
        warnings.push('No sail carousel image — map image will be used as fallback when the app is wired');
    }

    const storyChecks = storyList.map((story) => {
        const title = story.title || story.displayTitle || 'Untitled story';
        const bookId = story.bookId?._id || story.bookId;
        const hasBook = !!bookId;
        const puzzle = story.puzzle || {};
        const hasSlidingPuzzle = !!(
            puzzle.enabled &&
            puzzle.type === 'sliding_image' &&
            puzzle.imageUrl &&
            String(puzzle.imageUrl).trim()
        );
        const hasScripturePuzzle = !!(
            puzzle.enabled &&
            puzzle.type === 'scripture_words' &&
            puzzle.verseText &&
            String(puzzle.verseText).trim()
        );
        const hasPuzzle = hasSlidingPuzzle || hasScripturePuzzle;
        const hasColoring = Array.isArray(story.coloringPageIds) && story.coloringPageIds.length > 0;
        const hasQuiz = storyHasQuizContent(story);
        const hasGame = !!(story.game && story.game.enabled && story.game.kind && story.game.kind !== 'none');

        if (!hasBook) {
            blockers.push(`Story "${title}" needs a linked Bible Map book (Read)`);
        }
        if (!hasPuzzle) warnings.push(`Story "${title}" has no puzzle configured`);
        if (!hasColoring) warnings.push(`Story "${title}" has no coloring pages selected`);
        if (!hasQuiz) warnings.push(`Story "${title}" has no quiz content`);
        if (!hasGame) warnings.push(`Story "${title}" has no game unlock`);

        return {
            storyId: story._id,
            title,
            book: hasBook,
            puzzle: hasPuzzle,
            coloring: hasColoring,
            quiz: hasQuiz,
            game: hasGame,
        };
    });

    const ready = blockers.length === 0;

    return {
        ready,
        alreadyPublished: island.status === 'published',
        blockers,
        warnings,
        checklist,
        stories: storyChecks,
    };
}

function extractJsonFromAi(text) {
    if (!text) return null;
    let content = String(text).trim();
    try {
        return JSON.parse(content);
    } catch (_) {}
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
        try {
            return JSON.parse(fence[1].trim());
        } catch (_) {
            content = fence[1].trim();
        }
    }
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            return JSON.parse(content.slice(start, end + 1));
        } catch (_) {}
    }
    return null;
}

/**
 * GET /api/bible-map/quiz-assist/status
 * Whether Anthropic is configured for portal quiz chat.
 */
router.get('/quiz-assist/status', (req, res) => {
    const configured = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
    res.json({
        configured,
        message: configured
            ? 'Anthropic ready'
            : 'configure ANTHROPIC_API_KEY in backend/.env',
    });
});

/**
 * POST /api/bible-map/quiz-assist
 * Chat about a story-pack topic and propose ~7 leveled quiz questions.
 * Body: {
 *   messages: [{ role: 'user'|'assistant', content }],
 *   level: 'easy'|'medium'|'hard',
 *   count?: number (default 7),
 *   topic?: string,
 *   title?: string,
 *   scriptureRef?: string,
 *   verse?: string
 * }
 */
router.post('/quiz-assist', async (req, res) => {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim();
        if (!apiKey) {
            return res.status(503).json({
                error: 'AI quiz assist not configured',
                message: 'configure ANTHROPIC_API_KEY in backend/.env',
                configured: false,
            });
        }

        const {
            messages = [],
            level = 'easy',
            count = 7,
            topic = '',
            title = '',
            scriptureRef = '',
            verse = '',
        } = req.body || {};

        const quizLevel = QUIZ_LEVELS.includes(level) ? level : 'easy';
        const targetCount = Math.min(12, Math.max(3, Number(count) || 7));

        const levelGuide = {
            easy: 'Ages ~3–5. Very simple words, short options (2–4 words), who/what questions only.',
            medium:
                'Ages ~6–8. Simple vocabulary, short sentences, basic comprehension and sequence.',
            hard: 'Ages ~9–12. Deeper comprehension, themes, gentle inference; still kid-friendly faith language.',
        }[quizLevel];

        const contextBits = [
            title && `Story pack title: ${title}`,
            scriptureRef && `Scripture: ${scriptureRef}`,
            verse && `Spotlight verse: ${verse}`,
            topic && `Topic focus: ${topic}`,
        ]
            .filter(Boolean)
            .join('\n');

        const systemPrompt = `You are a helpful editor for Godly Kids Bible Map story-pack quizzes.
You chat with a content creator about the Bible story topic, then propose multiple-choice quiz questions.

Difficulty tier: ${quizLevel}
${levelGuide}
Target about ${targetCount} questions (okay to propose slightly fewer/more if the chat asks).

Rules:
- Faith-based, warm, accurate to the Bible story discussed
- Exactly 4 answer options per question
- One clearly correct answer
- Include a short kid-friendly explanation (1 sentence) for the correct answer
- Never invent harmful or scary content

When you propose questions, respond with ONLY valid JSON (no markdown) matching:
{
  "reply": "short friendly note to the editor",
  "proposedQuestions": [
    {
      "question": "...",
      "options": ["A","B","C","D"],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}

If the user is only chatting and not ready for questions yet, return:
{ "reply": "...", "proposedQuestions": [] }

${contextBits ? `Pack context:\n${contextBits}` : ''}`;

        const chatMessages = Array.isArray(messages)
            ? messages
                  .filter(
                      (m) =>
                          m &&
                          (m.role === 'user' || m.role === 'assistant') &&
                          typeof m.content === 'string' &&
                          m.content.trim(),
                  )
                  .slice(-16)
                  .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
            : [];

        if (chatMessages.length === 0) {
            return res.status(400).json({ error: 'messages required' });
        }

        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey });
        const model =
            process.env.ANTHROPIC_QUIZ_MODEL ||
            process.env.ANTHROPIC_MODEL_SONNET ||
            'claude-sonnet-5';

        const message = await anthropic.messages.create({
            model,
            max_tokens: 3500,
            temperature: 0.7,
            system: systemPrompt,
            messages: chatMessages,
        });

        const rawText = (message.content || [])
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
        const parsed = extractJsonFromAi(rawText);

        if (!parsed) {
            return res.json({
                reply: rawText || 'I could not format questions. Try asking again.',
                proposedQuestions: [],
                level: quizLevel,
            });
        }

        const proposedQuestions = (Array.isArray(parsed.proposedQuestions)
            ? parsed.proposedQuestions
            : []
        )
            .map(normalizeQuizQuestion)
            .filter(Boolean);

        res.json({
            reply:
                typeof parsed.reply === 'string' && parsed.reply.trim()
                    ? parsed.reply.trim()
                    : proposedQuestions.length
                      ? `Here are ${proposedQuestions.length} ${quizLevel} questions to review.`
                      : 'What would you like to cover in the quiz?',
            proposedQuestions,
            level: quizLevel,
            configured: true,
        });
    } catch (error) {
        console.error('quiz-assist error:', error?.message || error);
        const status =
            error?.status === 401 || error?.status === 403
                ? 503
                : error?.status && Number.isInteger(error.status)
                  ? error.status
                  : 500;
        res.status(status >= 400 && status < 600 ? status : 500).json({
            error: 'Quiz assist failed',
            message: error?.message || 'Anthropic request failed',
        });
    }
});

// ─── Age-leveled reading (Bible Map books) ────────────────────────────────

const READING_LEVEL_KEYS = ['ages_3_5', 'ages_6_7', 'ages_8_plus'];

function sanitizeWordIndices(text, indices) {
    const words = String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const wordCount = words.length;
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(indices) ? indices : []) {
        const i = Number(raw);
        if (!Number.isInteger(i) || i < 0 || i >= wordCount || seen.has(i)) continue;
        seen.add(i);
        out.push(i);
    }
    return out.sort((a, b) => a - b);
}

function normalizeReadingLevelEntry(raw) {
    const text = String(raw?.text || '').trim();
    return {
        text,
        interactiveWordIndices: sanitizeWordIndices(text, raw?.interactiveWordIndices),
    };
}

function normalizeReadingLevels(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        ages_3_5: normalizeReadingLevelEntry(src.ages_3_5),
        ages_6_7: normalizeReadingLevelEntry(src.ages_6_7),
        ages_8_plus: normalizeReadingLevelEntry(src.ages_8_plus),
    };
}

function readingLevelsHaveText(levels) {
    return READING_LEVEL_KEYS.some((k) => !!(levels?.[k]?.text || '').trim());
}

function defaultParchmentTextBox(text, interactiveWordIndices = []) {
    return {
        text: text || '',
        x: 12,
        y: 55,
        width: 76,
        height: 28,
        alignment: 'center',
        fontFamily: 'Patrick Hand',
        fontSize: 22,
        color: '#4a3b2a',
        showBackground: false,
        shadowColor: 'white',
        interactiveWordIndices: sanitizeWordIndices(text, interactiveWordIndices),
    };
}

/**
 * POST /api/bible-map/stories/:id/generate-reading-levels
 * Paste source story → Anthropic generates page scripts for ages 3–5 / 6–7 / 8+.
 */
router.post('/stories/:id/generate-reading-levels', async (req, res) => {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim();
        if (!apiKey) {
            return res.status(503).json({
                error: 'AI not configured',
                message: 'configure ANTHROPIC_API_KEY in backend/.env',
            });
        }

        const story = await MapStory.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });

        const sourceText = String(req.body?.sourceText || '').trim();
        if (!sourceText) {
            return res.status(400).json({ error: 'sourceText is required' });
        }

        const pageCount = Math.min(12, Math.max(3, Number(req.body?.pageCount) || 5));
        const scriptureRef = String(req.body?.scriptureRef || story.scriptureRef || '').trim();
        const title = String(req.body?.title || story.title || 'Bible Story').trim();

        // Ensure linked bible_map book
        let book;
        if (story.bookId) {
            book = await Book.findById(story.bookId);
        }
        if (!book) {
            const island = await MapIsland.findById(story.islandId);
            book = await Book.create({
                title,
                author: 'Godly Kids',
                description: story.verse || '',
                status: 'draft',
                bookType: 'bible_map',
                orientation: 'portrait',
                readerLayout: 'side_swipe',
                hasReadingLevels: true,
                category: island?.bookLabel || island?.title || 'Bible Map',
                categories: ['Bible Map', island?.title].filter(Boolean),
            });
            story.bookId = book._id;
            await story.save();
        }

        const systemPrompt = `You are a children's Bible editor for Godly Kids.
Rewrite the source story into ${pageCount} illustrated storybook pages for THREE age bands.

Age bands:
- ages_3_5: ages 3–5. Very short (1–3 simple sentences). Tiny words. Warm and concrete.
- ages_6_7: ages 6–7. Short paragraph (2–5 sentences). Clear sequence. Kid-friendly faith language.
- ages_8_plus: ages 8+. Fuller storytelling (3–7 sentences). Richer vocabulary, still kid-safe.

Rules:
- Faithful to the Bible story; no scary or graphic content
- Each page's three age texts must cover the SAME story beat / moment
- Suggest 1–4 interactiveWordIndices (0-based whitespace word indices) for key nouns kids can tap
- Respond with ONLY valid JSON (no markdown) matching:
{
  "pages": [
    {
      "pageNumber": 1,
      "ages_3_5": { "text": "...", "interactiveWordIndices": [0, 2] },
      "ages_6_7": { "text": "...", "interactiveWordIndices": [1] },
      "ages_8_plus": { "text": "...", "interactiveWordIndices": [3, 5] }
    }
  ]
}`;

        const userContent = `Title: ${title}
${scriptureRef ? `Scripture: ${scriptureRef}\n` : ''}
Source story:
${sourceText.slice(0, 12000)}`;

        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey });
        const model =
            process.env.ANTHROPIC_READING_MODEL ||
            process.env.ANTHROPIC_MODEL_SONNET ||
            'claude-sonnet-5';

        const message = await anthropic.messages.create({
            model,
            max_tokens: 8000,
            temperature: 0.6,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
        });

        const rawText = (message.content || [])
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
        const parsed = extractJsonFromAi(rawText);
        const aiPages = Array.isArray(parsed?.pages) ? parsed.pages : [];
        if (!aiPages.length) {
            return res.status(502).json({
                error: 'AI returned no pages',
                message: 'Try again with a clearer source story.',
                rawPreview: rawText.slice(0, 400),
            });
        }

        // Preserve existing media when regenerating; replace leveled text
        const existing = await Page.find({ bookId: book._id, isColoringPage: { $ne: true } })
            .sort({ pageNumber: 1 })
            .lean();
        const byNum = new Map(existing.map((p) => [p.pageNumber, p]));

        const saved = [];
        for (let i = 0; i < aiPages.length; i++) {
            const pageNumber = i + 1;
            const levels = normalizeReadingLevels({
                ages_3_5: aiPages[i].ages_3_5,
                ages_6_7: aiPages[i].ages_6_7,
                ages_8_plus: aiPages[i].ages_8_plus,
            });
            const primary = levels.ages_8_plus.text || levels.ages_6_7.text || levels.ages_3_5.text;
            const primaryIdx =
                levels.ages_8_plus.interactiveWordIndices.length
                    ? levels.ages_8_plus.interactiveWordIndices
                    : levels.ages_6_7.interactiveWordIndices;
            const prev = byNum.get(pageNumber);
            const payload = {
                bookId: book._id,
                pageNumber,
                readingLevels: levels,
                textBoxes: [defaultParchmentTextBox(primary, primaryIdx)],
                'content.text': primary,
                'content.textBoxes': [defaultParchmentTextBox(primary, primaryIdx)],
            };
            if (prev) {
                // keep media fields from previous page via $set only on text fields
                const updated = await Page.findByIdAndUpdate(
                    prev._id,
                    {
                        $set: {
                            readingLevels: levels,
                            textBoxes: [defaultParchmentTextBox(primary, primaryIdx)],
                            'content.text': primary,
                            'content.textBoxes': [defaultParchmentTextBox(primary, primaryIdx)],
                        },
                    },
                    { new: true },
                );
                saved.push(updated);
            } else {
                const created = await Page.create({
                    ...payload,
                    content: {
                        text: primary,
                        textBoxes: [defaultParchmentTextBox(primary, primaryIdx)],
                    },
                });
                saved.push(created);
            }
        }

        // Remove leftover story pages beyond generated count (keep coloring pages)
        await Page.deleteMany({
            bookId: book._id,
            isColoringPage: { $ne: true },
            pageNumber: { $gt: aiPages.length },
        });

        book.hasReadingLevels = true;
        await book.save();

        const pages = await Page.find({ bookId: book._id, isColoringPage: { $ne: true } })
            .sort({ pageNumber: 1 })
            .lean();

        res.json({
            bookId: book._id,
            pageCount: pages.length,
            pages,
            configured: true,
        });
    } catch (error) {
        console.error('generate-reading-levels error:', error?.message || error);
        const status =
            error?.status === 401 || error?.status === 403
                ? 503
                : error?.status && Number.isInteger(error.status)
                  ? error.status
                  : 500;
        res.status(status >= 400 && status < 600 ? status : 500).json({
            error: 'Failed to generate reading levels',
            message: error?.message || 'Anthropic request failed',
        });
    }
});

/**
 * PUT /api/bible-map/stories/:id/reading-pages
 * Bulk save slim builder pages (shared media + readingLevels).
 */
router.put('/stories/:id/reading-pages', async (req, res) => {
    try {
        const story = await MapStory.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });
        if (!story.bookId) {
            return res.status(400).json({ error: 'Story has no linked book' });
        }

        const book = await Book.findById(story.bookId);
        if (!book) return res.status(404).json({ error: 'Linked book not found' });

        const incoming = Array.isArray(req.body?.pages) ? req.body.pages : [];
        if (!incoming.length) {
            return res.status(400).json({ error: 'pages array required' });
        }

        const savedIds = [];
        for (let i = 0; i < incoming.length; i++) {
            const raw = incoming[i] || {};
            const pageNumber = Math.max(1, Number(raw.pageNumber) || i + 1);
            const levels = normalizeReadingLevels(raw.readingLevels);
            const primary =
                levels.ages_8_plus.text || levels.ages_6_7.text || levels.ages_3_5.text || '';
            const primaryIdx =
                levels.ages_8_plus.interactiveWordIndices.length
                    ? levels.ages_8_plus.interactiveWordIndices
                    : levels.ages_6_7.interactiveWordIndices;

            const backgroundUrl = String(
                raw.backgroundUrl || raw.files?.background?.url || '',
            ).trim();
            const backgroundType =
                raw.backgroundType === 'video' || raw.files?.background?.type === 'video'
                    ? 'video'
                    : 'image';
            const backgroundAudioUrl = String(raw.backgroundAudioUrl || '').trim();
            const scrollUrl = String(raw.scrollUrl || raw.files?.scroll?.url || '').trim();
            const scrollHeight =
                raw.scrollHeight != null ? Number(raw.scrollHeight) : undefined;
            const scrollMidHeight =
                raw.scrollMidHeight != null ? Number(raw.scrollMidHeight) : undefined;
            const scrollMaxHeight =
                raw.scrollMaxHeight != null ? Number(raw.scrollMaxHeight) : undefined;
            const scrollOffsetY =
                raw.scrollOffsetY != null ? Number(raw.scrollOffsetY) : 0;
            const scrollOffsetX =
                raw.scrollOffsetX != null ? Number(raw.scrollOffsetX) : 0;
            const scrollWidth =
                raw.scrollWidth != null ? Number(raw.scrollWidth) : 100;
            const scrollOpacity =
                raw.scrollOpacity != null ? Number(raw.scrollOpacity) : 100;

            const setDoc = {
                bookId: book._id,
                pageNumber,
                isColoringPage: false,
                readingLevels: levels,
                textBoxes: [defaultParchmentTextBox(primary, primaryIdx)],
                content: {
                    text: primary,
                    textBoxes: [defaultParchmentTextBox(primary, primaryIdx)],
                },
                backgroundUrl: backgroundUrl || undefined,
                backgroundType: backgroundUrl ? backgroundType : undefined,
                backgroundAudioUrl:
                    backgroundType === 'video' && backgroundAudioUrl
                        ? backgroundAudioUrl
                        : null,
                scrollUrl: scrollUrl || undefined,
                scrollOffsetY,
                scrollOffsetX,
                scrollWidth,
                scrollOpacity,
                files: {
                    background: backgroundUrl
                        ? { url: backgroundUrl, type: backgroundType }
                        : undefined,
                    scroll: scrollUrl
                        ? {
                              url: scrollUrl,
                              height: scrollHeight,
                          }
                        : undefined,
                },
            };
            if (scrollHeight != null && Number.isFinite(scrollHeight)) {
                setDoc.scrollHeight = scrollHeight;
            }
            if (scrollMidHeight != null && Number.isFinite(scrollMidHeight)) {
                setDoc.scrollMidHeight = scrollMidHeight;
            }
            if (scrollMaxHeight != null && Number.isFinite(scrollMaxHeight)) {
                setDoc.scrollMaxHeight = scrollMaxHeight;
            }

            const page = await Page.findOneAndUpdate(
                { bookId: book._id, pageNumber, isColoringPage: { $ne: true } },
                { $set: setDoc },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );
            savedIds.push(page._id);
        }

        await Page.deleteMany({
            bookId: book._id,
            isColoringPage: { $ne: true },
            _id: { $nin: savedIds },
        });

        book.hasReadingLevels = true;
        await book.save();

        const pages = await Page.find({ bookId: book._id, isColoringPage: { $ne: true } })
            .sort({ pageNumber: 1 })
            .lean();

        res.json({ bookId: book._id, pages });
    } catch (error) {
        console.error('reading-pages save error:', error?.message || error);
        res.status(500).json({ error: error.message || 'Failed to save reading pages' });
    }
});

/**
 * GET /api/bible-map/stories/:id/reading-pages
 */
router.get('/stories/:id/reading-pages', async (req, res) => {
    try {
        const story = await MapStory.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });
        if (!story.bookId) {
            return res.json({ bookId: null, pages: [], hasReadingLevels: false });
        }
        const book = await Book.findById(story.bookId).lean();
        const pages = await Page.find({
            bookId: story.bookId,
            isColoringPage: { $ne: true },
        })
            .sort({ pageNumber: 1 })
            .lean();
        res.json({
            bookId: story.bookId,
            book,
            pages,
            hasReadingLevels: !!book?.hasReadingLevels || pages.some((p) => readingLevelsHaveText(p.readingLevels)),
        });
    } catch (error) {
        console.error('reading-pages get error:', error?.message || error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
