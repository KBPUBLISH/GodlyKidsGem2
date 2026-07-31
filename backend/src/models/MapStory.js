const mongoose = require('mongoose');

/**
 * One adventure on a Bible Map island (e.g. "1. The Beginning").
 * Bundles Read (bible_map book) + Puzzle + Coloring + Quiz + Game.
 */
const mapStorySchema = new mongoose.Schema(
    {
        islandId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MapIsland',
            required: true,
            index: true,
        },
        order: {
            type: Number,
            default: 1,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        /** Display title on island scene (e.g. "1. THE BEGINNING") */
        displayTitle: {
            type: String,
            trim: true,
        },
        scriptureRef: {
            type: String,
            trim: true,
        },
        verse: {
            type: String,
            trim: true,
        },
        verseRef: {
            type: String,
            trim: true,
        },
        heroImageUrl: {
            type: String,
        },
        introVideoUrl: {
            type: String,
        },
        sceneBgVideoUrl: {
            type: String,
        },
        /** Looping background music for this story’s island scene (not the book reader). */
        sceneMusicUrl: {
            type: String,
        },
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
        },

        // —— READ ——
        bookId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Book',
            default: null,
        },

        // —— QUIZ ——
        // book_quiz: use AI/cached BookQuiz for bookId
        // custom: use quiz.levels (portal-authored); customQuestions kept for legacy
        quizMode: {
            type: String,
            enum: ['book_quiz', 'custom', 'none'],
            default: 'book_quiz',
        },
        /** @deprecated Prefer quiz.levels; still synced from easy for older clients */
        customQuestions: [
            {
                question: String,
                options: [String],
                correctIndex: Number,
                explanation: String,
            },
        ],
        quiz: {
            defaultLevel: {
                type: String,
                enum: ['easy', 'medium', 'hard'],
                default: 'easy',
            },
            levels: {
                easy: [
                    {
                        question: String,
                        options: [String],
                        correctIndex: Number,
                        explanation: String,
                    },
                ],
                medium: [
                    {
                        question: String,
                        options: [String],
                        correctIndex: Number,
                        explanation: String,
                    },
                ],
                hard: [
                    {
                        question: String,
                        options: [String],
                        correctIndex: Number,
                        explanation: String,
                    },
                ],
            },
        },

        // —— COLORING ——
        // Page IDs flagged as coloring pages (linked book pages and/or standalone
        // bible-map tap-fill pages created without a Book document)
        coloringPageIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Page',
            },
        ],

        // —— PUZZLE ——
        // sliding_image: N×N picture tile slide (easy 3×3 / medium 4×4 / hard 5×5)
        // scripture_words: legacy word scramble (kept for existing packs)
        puzzle: {
            enabled: { type: Boolean, default: false },
            type: {
                type: String,
                enum: ['sliding_image', 'scripture_words', 'none'],
                default: 'sliding_image',
            },
            /** PNG/JPG URL for sliding_image puzzles */
            imageUrl: { type: String },
            /** Difficulties kids can pick in-app */
            difficulties: {
                type: [
                    {
                        type: String,
                        enum: ['easy', 'medium', 'hard'],
                    },
                ],
                default: ['easy', 'medium', 'hard'],
            },
            defaultDifficulty: {
                type: String,
                enum: ['easy', 'medium', 'hard'],
                default: 'easy',
            },
            /** Verse text to scramble into word tiles (scripture_words only) */
            verseText: { type: String },
            verseRef: { type: String },
        },

        // —— GAME ——
        game: {
            enabled: { type: Boolean, default: false },
            /** catalog = Game collection by gameId string; book_game = custom webview on pack */
            kind: {
                type: String,
                enum: ['catalog', 'webview', 'none'],
                default: 'none',
            },
            /** Game.gameId when kind === 'catalog' */
            gameId: { type: String },
            /** Webview unlock game when kind === 'webview' */
            webview: {
                title: String,
                url: String,
                coverImage: String,
                description: String,
            },
        },

        /**
         * Suggested unlock order for activities after Read.
         * App can ignore and use its own rules later.
         */
        unlockOrder: {
            type: [String],
            default: ['read', 'quiz', 'puzzle', 'coloring', 'game'],
        },

        /**
         * Scene Studio — phone/tablet button overlays on intro + looping BG video.
         * Coordinates are percent of the device frame (0–100).
         * Empty / missing layout → app uses hardcoded ACTIVITIES tray.
         */
        sceneLayout: {
            phone: {
                showActivitiesBoard: { type: Boolean, default: true },
                buttons: [
                    {
                        id: { type: String, required: true },
                        x: { type: Number, default: 10 },
                        y: { type: Number, default: 70 },
                        w: { type: Number, default: 14 },
                        h: { type: Number, default: 12 },
                        iconUrl: { type: String },
                        label: { type: String },
                        lockedUntil: {
                            type: String,
                            enum: ['always', 'content', 'trigger'],
                            default: 'content',
                        },
                    },
                ],
            },
            tablet: {
                showActivitiesBoard: { type: Boolean, default: true },
                buttons: [
                    {
                        id: { type: String, required: true },
                        x: { type: Number, default: 10 },
                        y: { type: Number, default: 70 },
                        w: { type: Number, default: 14 },
                        h: { type: Number, default: 12 },
                        iconUrl: { type: String },
                        label: { type: String },
                        lockedUntil: {
                            type: String,
                            enum: ['always', 'content', 'trigger'],
                            default: 'content',
                        },
                    },
                ],
            },
        },

        /** Animation clips that button triggers can play */
        sceneAnimations: [
            {
                id: { type: String, required: true },
                label: { type: String, default: '' },
                videoUrl: { type: String, required: true },
            },
        ],

        /** Simple rules: button tap → play animation → navigate or stay */
        sceneTriggers: [
            {
                id: { type: String, required: true },
                fromButtonId: { type: String, required: true },
                animationId: { type: String, default: '' },
                after: {
                    type: String,
                    enum: ['navigate', 'stay'],
                    default: 'navigate',
                },
                navigateTo: {
                    type: String,
                    enum: ['read', 'quiz', 'puzzle', 'coloring', 'game', ''],
                    default: '',
                },
            },
        ],
    },
    {
        timestamps: true,
    },
);

mapStorySchema.index({ islandId: 1, order: 1 });
mapStorySchema.index({ status: 1 });

module.exports = mongoose.model('MapStory', mapStorySchema);
