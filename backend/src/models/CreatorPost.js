const mongoose = require('mongoose');

const creatorPostSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
        required: true,
        index: true,
    },
    body: {
        type: String,
        default: '',
        maxlength: 800,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    likeCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: ['published', 'pending', 'hidden'],
        default: 'published',
        index: true,
    },
    holdReason: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

creatorPostSchema.index({ creatorId: 1, createdAt: -1 });
creatorPostSchema.index({ creatorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorPost', creatorPostSchema);
