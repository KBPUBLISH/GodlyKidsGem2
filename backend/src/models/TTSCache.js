const mongoose = require('mongoose');

/**
 * Permanent TTS cache. Entries are never expired by time.
 * Only removed when: cache clear by book/all (portal), invalid audioUrl (cleanup script), or local→GCS migration.
 * Keeps ElevenLabs usage down by reusing generated audio.
 */
const ttsCacheSchema = new mongoose.Schema({
    textHash: {
        type: String,
        required: true,
        index: true
    },
    voiceId: {
        type: String,
        required: true,
        index: true
    },
    text: {
        type: String,
        required: true
    },
    audioUrl: {
        type: String,
        required: true
    },
    alignmentData: {
        type: mongoose.Schema.Types.Mixed, // JSON object with character start/end times
        required: true
    },
    // Optional: bookId for clearing cache by book
    bookId: {
        type: String,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
        // No TTL index - cache is permanent. Do not add expiration.
    }
});

// Compound index for fast lookups
ttsCacheSchema.index({ textHash: 1, voiceId: 1 }, { unique: true });
// Index for clearing cache by book
ttsCacheSchema.index({ bookId: 1 });

module.exports = mongoose.model('TTSCache', ttsCacheSchema);
