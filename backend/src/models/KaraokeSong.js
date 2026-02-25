const mongoose = require('mongoose');

const lyricSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
    },
    startTime: {
        type: Number,
        required: true,
    },
    endTime: {
        type: Number,
        required: true,
    },
}, { _id: false });

const karaokeSongSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    coverImage: {
        type: String,
    },
    videoUrl: {
        type: String,
    },
    backgroundAudioUrl: {
        type: String,
    },
    duration: {
        type: Number,
        default: 0,
    },
    lyrics: [lyricSchema],
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
    order: {
        type: Number,
        default: 0,
    },
    minAge: {
        type: Number,
        min: 0,
        max: 18,
    },
    isMembersOnly: {
        type: Boolean,
        default: false,
    },
    goalTags: {
        type: [String],
        default: [],
    },
    coverImagePrompts: {
        type: [String],
        default: [],
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    recordCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

karaokeSongSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
        next();
    }
});

karaokeSongSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model('KaraokeSong', karaokeSongSchema);
