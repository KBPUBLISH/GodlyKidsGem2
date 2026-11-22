const mongoose = require('mongoose');

/**
 * A voyage destination on the Bible Map (e.g. Genesis, Exodus).
 * Stories (adventures) live under an island and unlock as a pack.
 */
const mapIslandSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'],
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        /** Short label on map art (e.g. "Genesis") */
        bookLabel: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        /** Map overview island art */
        mapArtUrl: {
            type: String,
        },
        /** Sail carousel card art */
        sailArtUrl: {
            type: String,
        },
        /** Position on the scrollable map (percent 0–100) */
        mapPosition: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 50 },
        },
        order: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
        },
        /**
         * Unlock rule for sailing to this island.
         * - always: available from the start
         * - previous_complete: unlock when the prior island (by order) is fully complete
         */
        unlockRule: {
            type: String,
            enum: ['always', 'previous_complete'],
            default: 'previous_complete',
        },
        introVideoUrl: {
            type: String,
        },
        sceneBgVideoUrl: {
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

mapIslandSchema.index({ order: 1 });
mapIslandSchema.index({ status: 1 });

module.exports = mongoose.model('MapIsland', mapIslandSchema);
