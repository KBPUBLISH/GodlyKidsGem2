const mongoose = require('mongoose');

const wallNoteSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
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
        default: 'A family',
    },
    body: {
        type: String,
        required: true,
        maxlength: 800,
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

wallNoteSchema.index({ creatorId: 1, createdAt: -1 });
wallNoteSchema.index({ creatorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('WallNote', wallNoteSchema);
