const mongoose = require('mongoose');

/**
 * User's monthly custom book request/generated book.
 * Created when user completes onboarding; job generates Book + Pages.
 */
const customMonthlyBookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppUser',
        required: true,
        index: true,
    },
    kidId: {
        type: String,
        required: true,
        index: true, // Kid profile id (frontend id or mongo _id string)
    },
    // Template user selected (Bible character story)
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyBookTemplate',
        required: true,
        index: true,
    },
    childName: {
        type: String,
        required: true,
    },
    // Child's avatar/reference image URL (from selfie + style)
    childCharacterImageUrl: {
        type: String,
    },
    // MVP: one style; store style id or label if we need it for generation
    characterStyleId: {
        type: String,
        default: 'illustrated',
    },
    // Trial gate: true = user had trial/paid when requested → full book; false = first 4 pages only
    hasTrialOrPaid: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['pending', 'generating', 'completed', 'failed'],
        default: 'pending',
        index: true,
    },
    // When completed, the generated Book
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        index: true,
    },
    errorMessage: {
        type: String,
    },
    // Notifications sent
    notificationSentAt: { type: Date },
    notification24hSentAt: { type: Date },
}, { timestamps: true });

customMonthlyBookSchema.index({ userId: 1, createdAt: -1 });
customMonthlyBookSchema.index({ status: 1 });

module.exports = mongoose.model('CustomMonthlyBook', customMonthlyBookSchema);
