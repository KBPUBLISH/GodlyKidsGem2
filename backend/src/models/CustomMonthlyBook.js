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
    // Raw identifier from client (email or deviceId) — used for push so OneSignal external_user_id matches
    rawUserId: {
        type: String,
        required: false,
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
    // Original selfie image URL (uploaded when creating book; for before/after display)
    childSelfieUrl: {
        type: String,
    },
    // Multi-character (1–3): when set, generator uses these; childName/childCharacterImageUrl = first for legacy
    characters: [{
        name: { type: String, required: true },
        characterImageUrl: { type: String },
    }],
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
    // User-selected background music track (0, 1, or 2) from source book's up-to-3 tracks
    backgroundMusicIndex: {
        type: Number,
        default: 0,
        min: 0,
        max: 2,
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
    progressPage: { type: Number, default: 0 },
    progressTotalPages: { type: Number, default: 0 },
    errorMessage: {
        type: String,
    },
    // Notifications sent
    notificationSentAt: { type: Date },
    notification24hSentAt: { type: Date },
    // Share link: secret token for read-only access without subscription (e.g. share with grandma)
    shareToken: {
        type: String,
        sparse: true,
        unique: true,
    },
}, { timestamps: true });

customMonthlyBookSchema.index({ userId: 1, createdAt: -1 });
customMonthlyBookSchema.index({ status: 1 });
customMonthlyBookSchema.index({ bookId: 1, shareToken: 1 });

module.exports = mongoose.model('CustomMonthlyBook', customMonthlyBookSchema);
