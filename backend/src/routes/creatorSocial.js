/**
 * Kid-safe creator social layer (posts, likes, comments, wall notes).
 *
 * Mounted from hub.js (`router.use(require('./creatorSocial'))`) so this
 * ships without touching src/index.js.
 *
 * Identity (same as Follow / HubSeriesReview):
 *   1. App JWT email via optionalAuthenticateUser → req.user.email
 *   2. Else device/email from body or query (userId / userEmail / email)
 * Writes require a userId. Emails are stored for support but never returned.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const Creator = require('../models/Creator');
const AppUser = require('../models/AppUser');
const CreatorPost = require('../models/CreatorPost');
const PostComment = require('../models/PostComment');
const PostLike = require('../models/PostLike');
const WallNote = require('../models/WallNote');
const { authenticateCreator } = require('./creatorAuth');
const { optionalAuthenticateUser } = require('../middleware/auth');
const { identityFromRequest } = require('../utils/appIdentity');
const {
    checkSocialText,
    ANONYMOUS_DISPLAY_NAME,
    checkReviewDisplayName,
} = require('../utils/kidSafeComment');

const router = express.Router();

const COMMENT_MAX_LEN = 280;
const POST_MAX_LEN = 800;

const socialWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Please wait a moment before posting again.' },
});

const creatorWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Please wait a moment before posting again.' },
});

function isObjectId(id) {
    return /^[a-f0-9]{24}$/i.test(String(id || ''));
}

function safeImageUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url) || url.length > 2000) return null;
    return url;
}

function firstNameFrom(raw) {
    const first = String(raw || '').trim().split(/\s+/)[0] || '';
    if (first.length < 2 || first.length > 24) return '';
    const checked = checkReviewDisplayName(first);
    return checked.ok ? checked.displayName : '';
}

async function familyDisplayName(identity) {
    if (!identity.userId && !identity.userEmail) return ANONYMOUS_DISPLAY_NAME;
    const appUser = await AppUser.findOne({
        $or: [
            { deviceId: identity.userId },
            ...(identity.userEmail ? [{ email: identity.userEmail }] : []),
        ],
    }).select('kidProfiles').lean();
    const kidName = (appUser?.kidProfiles || []).find((kid) => kid?.name)?.name;
    return firstNameFrom(kidName) || ANONYMOUS_DISPLAY_NAME;
}

function requireIdentity(res, identity, action) {
    if (identity.userId) return true;
    res.status(400).json({ error: `Sign in or keep this device to ${action}` });
    return false;
}

async function loadPublicCreator(id) {
    if (!isObjectId(id)) return null;
    const creator = await Creator.findById(id).select('status').lean();
    if (!creator || creator.status === 'suspended') return null;
    return creator;
}

async function commentCountMap(postIds) {
    if (!postIds.length) return new Map();
    const rows = await PostComment.aggregate([
        { $match: { postId: { $in: postIds }, status: 'published' } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), row.count]));
}

function toPublicPost(post, { likedByMe = false, commentCount = 0 } = {}) {
    return {
        id: String(post._id),
        creatorId: String(post.creatorId),
        body: post.body || '',
        imageUrl: post.imageUrl || '',
        likeCount: Math.max(0, post.likeCount || 0),
        likedByMe: Boolean(likedByMe),
        commentCount: commentCount || 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        status: post.status,
    };
}

function toPublicNote(doc, identity) {
    return {
        id: String(doc._id),
        body: doc.body || '',
        displayName: doc.displayName || ANONYMOUS_DISPLAY_NAME,
        createdAt: doc.createdAt,
        mine: identity.userId ? doc.userId === identity.userId : false,
    };
}

// GET /api/hub/creators/:id/posts
router.get('/creators/:id/posts', optionalAuthenticateUser, async (req, res) => {
    try {
        if (!(await loadPublicCreator(req.params.id))) {
            return res.status(404).json({ error: 'Creator not found' });
        }

        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const posts = await CreatorPost.find({
            creatorId: req.params.id,
            status: 'published',
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const identity = identityFromRequest(req);
        const ids = posts.map((post) => post._id);
        const [liked, counts] = await Promise.all([
            identity.userId && ids.length
                ? PostLike.find({ postId: { $in: ids }, userId: identity.userId }).select('postId').lean()
                : [],
            commentCountMap(ids),
        ]);
        const likedSet = new Set(liked.map((row) => String(row.postId)));

        res.json({
            posts: posts.map((post) => toPublicPost(post, {
                likedByMe: likedSet.has(String(post._id)),
                commentCount: counts.get(String(post._id)) || 0,
            })),
        });
    } catch (error) {
        console.error('List creator posts error:', error);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

// GET /api/hub/creators/:id/wall
router.get('/creators/:id/wall', optionalAuthenticateUser, async (req, res) => {
    try {
        if (!(await loadPublicCreator(req.params.id))) {
            return res.status(404).json({ error: 'Creator not found' });
        }

        const identity = identityFromRequest(req);
        const notes = await WallNote.find({
            creatorId: req.params.id,
            status: 'published',
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ notes: notes.map((note) => toPublicNote(note, identity)) });
    } catch (error) {
        console.error('List wall notes error:', error);
        res.status(500).json({ error: 'Failed to load wall notes' });
    }
});

// POST /api/hub/creators/:id/wall
router.post('/creators/:id/wall', optionalAuthenticateUser, socialWriteLimiter, async (req, res) => {
    try {
        const identity = identityFromRequest(req);
        if (!requireIdentity(res, identity, 'write on this profile')) return;
        if (!(await loadPublicCreator(req.params.id))) {
            return res.status(404).json({ error: 'Creator not found' });
        }

        const cleaned = await checkSocialText(req.body?.body || req.body?.comment, {
            maxLen: COMMENT_MAX_LEN,
        });
        if (!cleaned.ok) {
            return res.status(400).json({ error: cleaned.error, reason: cleaned.reason });
        }

        const note = await WallNote.create({
            creatorId: req.params.id,
            userId: identity.userId,
            userEmail: identity.userEmail,
            displayName: await familyDisplayName(identity),
            body: cleaned.comment,
            status: cleaned.status,
            holdReason: cleaned.pendingReason || '',
        });

        const pending = note.status === 'pending';
        res.status(pending ? 202 : 201).json({
            success: true,
            status: note.status,
            message: pending
                ? 'Saved — our team will take a quick look before it shows.'
                : undefined,
            note: pending ? undefined : toPublicNote(note, identity),
        });
    } catch (error) {
        console.error('Create wall note error:', error);
        res.status(500).json({ error: 'Failed to save wall note' });
    }
});

// GET /api/hub/posts/:postId/comments
router.get('/posts/:postId/comments', optionalAuthenticateUser, async (req, res) => {
    try {
        if (!isObjectId(req.params.postId)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const post = await CreatorPost.findById(req.params.postId).select('status').lean();
        if (!post || post.status !== 'published') {
            return res.status(404).json({ error: 'Post not found' });
        }

        const identity = identityFromRequest(req);
        const comments = await PostComment.find({
            postId: req.params.postId,
            status: 'published',
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ comments: comments.map((comment) => toPublicNote(comment, identity)) });
    } catch (error) {
        console.error('List post comments error:', error);
        res.status(500).json({ error: 'Failed to load comments' });
    }
});

// POST /api/hub/posts/:postId/comments
router.post('/posts/:postId/comments', optionalAuthenticateUser, socialWriteLimiter, async (req, res) => {
    try {
        const identity = identityFromRequest(req);
        if (!requireIdentity(res, identity, 'comment')) return;
        if (!isObjectId(req.params.postId)) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = await CreatorPost.findById(req.params.postId).select('status').lean();
        if (!post || post.status !== 'published') {
            return res.status(404).json({ error: 'Post not found' });
        }

        const cleaned = await checkSocialText(req.body?.body || req.body?.comment, {
            maxLen: COMMENT_MAX_LEN,
        });
        if (!cleaned.ok) {
            return res.status(400).json({ error: cleaned.error, reason: cleaned.reason });
        }

        const comment = await PostComment.create({
            postId: req.params.postId,
            userId: identity.userId,
            userEmail: identity.userEmail,
            displayName: await familyDisplayName(identity),
            body: cleaned.comment,
            status: cleaned.status,
            holdReason: cleaned.pendingReason || '',
        });

        const pending = comment.status === 'pending';
        res.status(pending ? 202 : 201).json({
            success: true,
            status: comment.status,
            message: pending
                ? 'Saved — our team will take a quick look before it shows.'
                : undefined,
            comment: pending ? undefined : toPublicNote(comment, identity),
        });
    } catch (error) {
        console.error('Create post comment error:', error);
        res.status(500).json({ error: 'Failed to save comment' });
    }
});

// POST /api/hub/posts/:postId/like — toggle
router.post('/posts/:postId/like', optionalAuthenticateUser, socialWriteLimiter, async (req, res) => {
    try {
        const identity = identityFromRequest(req);
        if (!requireIdentity(res, identity, 'like a post')) return;
        if (!isObjectId(req.params.postId)) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = await CreatorPost.findById(req.params.postId);
        if (!post || post.status !== 'published') {
            return res.status(404).json({ error: 'Post not found' });
        }

        const existing = await PostLike.findOne({
            postId: post._id,
            userId: identity.userId,
        });

        let likedByMe;
        if (existing) {
            await existing.deleteOne();
            post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
            likedByMe = false;
        } else {
            try {
                await PostLike.create({ postId: post._id, userId: identity.userId });
                post.likeCount = (post.likeCount || 0) + 1;
                likedByMe = true;
            } catch (err) {
                if (err.code !== 11000) throw err;
                likedByMe = true;
            }
        }
        await post.save();

        res.json({
            success: true,
            likedByMe,
            likeCount: Math.max(0, post.likeCount || 0),
        });
    } catch (error) {
        console.error('Toggle post like error:', error);
        res.status(500).json({ error: 'Failed to update like' });
    }
});

async function cleanCreatorPostBody(raw, imageUrl) {
    const text = String(raw || '').trim();
    if (!text && imageUrl) {
        return { ok: true, comment: '', status: 'published' };
    }
    return checkSocialText(raw, { maxLen: POST_MAX_LEN });
}

// GET /api/hub/my-posts
router.get('/my-posts', authenticateCreator, async (req, res) => {
    try {
        const posts = await CreatorPost.find({ creatorId: req.creator._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        const counts = await commentCountMap(posts.map((post) => post._id));
        res.json({
            posts: posts.map((post) => toPublicPost(post, {
                commentCount: counts.get(String(post._id)) || 0,
            })),
        });
    } catch (error) {
        console.error('List my posts error:', error);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

// POST /api/hub/my-posts
router.post('/my-posts', authenticateCreator, creatorWriteLimiter, async (req, res) => {
    try {
        const imageUrl = safeImageUrl(req.body?.imageUrl);
        if (imageUrl === null) {
            return res.status(400).json({ error: 'Image link must be a regular http or https address.' });
        }

        const cleaned = await cleanCreatorPostBody(req.body?.body, imageUrl);
        if (!cleaned.ok) {
            return res.status(400).json({ error: cleaned.error, reason: cleaned.reason });
        }
        if (!cleaned.comment && !imageUrl) {
            return res.status(400).json({ error: 'Write a short note or add a photo.' });
        }

        const post = await CreatorPost.create({
            creatorId: req.creator._id,
            body: cleaned.comment,
            imageUrl,
            status: cleaned.status,
            holdReason: cleaned.pendingReason || '',
        });

        res.status(201).json({ post: toPublicPost(post) });
    } catch (error) {
        console.error('Create creator post error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// PUT /api/hub/my-posts/:id
router.put('/my-posts/:id', authenticateCreator, creatorWriteLimiter, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const post = await CreatorPost.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        if (req.body?.imageUrl !== undefined) {
            const imageUrl = safeImageUrl(req.body.imageUrl);
            if (imageUrl === null) {
                return res.status(400).json({ error: 'Image link must be a regular http or https address.' });
            }
            post.imageUrl = imageUrl;
        }

        if (req.body?.body !== undefined) {
            const cleaned = await cleanCreatorPostBody(req.body.body, post.imageUrl);
            if (!cleaned.ok) {
                return res.status(400).json({ error: cleaned.error, reason: cleaned.reason });
            }
            if (!cleaned.comment && !post.imageUrl) {
                return res.status(400).json({ error: 'Write a short note or add a photo.' });
            }
            post.body = cleaned.comment;
            post.status = cleaned.status;
            post.holdReason = cleaned.pendingReason || '';
        }

        await post.save();
        res.json({ post: toPublicPost(post) });
    } catch (error) {
        console.error('Update creator post error:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// DELETE /api/hub/my-posts/:id
router.delete('/my-posts/:id', authenticateCreator, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const post = await CreatorPost.findOneAndDelete({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        await Promise.all([
            PostComment.deleteMany({ postId: post._id }),
            PostLike.deleteMany({ postId: post._id }),
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete creator post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// GET /api/hub/my-wall — creator moderation list
router.get('/my-wall', authenticateCreator, async (req, res) => {
    try {
        const notes = await WallNote.find({
            creatorId: req.creator._id,
            status: { $ne: 'pending' },
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json({
            notes: notes.map((note) => ({
                id: String(note._id),
                body: note.body || '',
                displayName: note.displayName || ANONYMOUS_DISPLAY_NAME,
                createdAt: note.createdAt,
                status: note.status,
            })),
        });
    } catch (error) {
        console.error('List my wall error:', error);
        res.status(500).json({ error: 'Failed to load wall notes' });
    }
});

// DELETE /api/hub/my-wall/:id — hide a wall note
router.delete('/my-wall/:id', authenticateCreator, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const note = await WallNote.findOne({
            _id: req.params.id,
            creatorId: req.creator._id,
        });
        if (!note) return res.status(404).json({ error: 'Note not found' });

        note.status = 'hidden';
        await note.save();
        res.json({ success: true, status: 'hidden' });
    } catch (error) {
        console.error('Hide wall note error:', error);
        res.status(500).json({ error: 'Failed to hide wall note' });
    }
});

module.exports = router;
