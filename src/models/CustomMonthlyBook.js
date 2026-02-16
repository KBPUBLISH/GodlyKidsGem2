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
    // Template user selected (Bible character story) – used for legacy template-based flow
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyBookTemplate',
        required: false,
        index: true,
    },
    // Source Book from Book Builder – used for create-from-book flow (Book with bookType kids_monthly)
    sourceBookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: false,
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
    // How the main character (kid) is drawn — from character creation or chosen here
    characterStyleId: {
        type: String,
        default: 'illustrated',
    },
    // How the whole book is drawn (all characters + environment); can differ from character (e.g. Lego you in a Pixar book)
    bookStyleId: {
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
