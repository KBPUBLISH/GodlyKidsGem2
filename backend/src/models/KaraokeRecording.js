const mongoose = require('mongoose');

const karaokeRecordingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    karaokeSongId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KaraokeSong',
        required: true,
    },
    mixedAudioUrl: {
        type: String,
        required: true,
    },
    recordedAt: {
        type: Date,
        default: Date.now,
    },
    duration: {
        type: Number,
        default: 0,
    },
    customCoverImageUrl: {
        type: String,
        default: null,
    },
    artistName: {
        type: String,
        default: null,
    },
}, { timestamps: true });

karaokeRecordingSchema.index({ userId: 1, karaokeSongId: 1 });

module.exports = mongoose.model('KaraokeRecording', karaokeRecordingSchema);
