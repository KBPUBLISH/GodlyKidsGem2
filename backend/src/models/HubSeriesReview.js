const mongoose = require('mongoose');

const hubSeriesReviewSchema = new mongoose.Schema({
    playlistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HubPlaylist',
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    userEmail: {
        type: String,
        index: true,
    },
    displayName: {
        type: String,
        default: 'A parent',
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        default: '',
        maxlength: 280,
    },
}, {
    timestamps: true,
});

hubSeriesReviewSchema.index({ playlistId: 1, userId: 1 }, { unique: true });
hubSeriesReviewSchema.index({ playlistId: 1, createdAt: -1 });

module.exports = mongoose.model('HubSeriesReview', hubSeriesReviewSchema);
