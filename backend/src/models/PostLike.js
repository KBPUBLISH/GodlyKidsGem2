const mongoose = require('mongoose');

const postLikeSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CreatorPost',
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
}, {
    timestamps: true,
});

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('PostLike', postLikeSchema);
