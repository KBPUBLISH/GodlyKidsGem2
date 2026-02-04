const mongoose = require('mongoose');

const backgroundMusicSchema = new mongoose.Schema({
    // Display name for the track
    name: {
        type: String,
        required: true,
    },
    
    // Description of the mood/feel
    description: {
        type: String,
    },
    
    // URL to the audio file in GCS
    audioUrl: {
        type: String,
        required: true,
    },
    
    // Learning goal tags this music is appropriate for
    goalTags: [{
        type: String,
        enum: ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'],
    }],
    
    // Duration in seconds (for display)
    duration: {
        type: Number,
    },
    
    // Mood/style tags for additional filtering
    moodTags: [{
        type: String,
        enum: ['peaceful', 'uplifting', 'adventurous', 'gentle', 'joyful', 'reflective', 'hopeful', 'triumphant'],
    }],
    
    // Whether this is the default track for its goal tags
    isDefault: {
        type: Boolean,
        default: false,
    },
    
    // Active status
    isActive: {
        type: Boolean,
        default: true,
    },
    
    // Usage count for analytics
    usageCount: {
        type: Number,
        default: 0,
    },
    
}, {
    timestamps: true,
});

// Index for efficient querying
backgroundMusicSchema.index({ goalTags: 1, isActive: 1 });
backgroundMusicSchema.index({ isDefault: 1, goalTags: 1 });

// Static method to find music for a goal tag
backgroundMusicSchema.statics.findForGoal = async function(goalTag) {
    // First try to find a default track for this goal
    let music = await this.findOne({
        goalTags: goalTag,
        isDefault: true,
        isActive: true,
    });
    
    // If no default, pick a random active track for this goal
    if (!music) {
        const tracks = await this.find({
            goalTags: goalTag,
            isActive: true,
        });
        
        if (tracks.length > 0) {
            music = tracks[Math.floor(Math.random() * tracks.length)];
        }
    }
    
    // Increment usage count
    if (music) {
        await this.updateOne({ _id: music._id }, { $inc: { usageCount: 1 } });
    }
    
    return music;
};

// Static method to find music for multiple goal tags (returns best match)
backgroundMusicSchema.statics.findForGoals = async function(goalTags) {
    if (!goalTags || goalTags.length === 0) {
        // Return any default track
        return this.findOne({ isDefault: true, isActive: true });
    }
    
    // Find tracks that match any of the goal tags, prefer those matching more tags
    const tracks = await this.aggregate([
        { $match: { goalTags: { $in: goalTags }, isActive: true } },
        {
            $addFields: {
                matchCount: {
                    $size: { $setIntersection: ['$goalTags', goalTags] }
                }
            }
        },
        { $sort: { isDefault: -1, matchCount: -1 } },
        { $limit: 1 }
    ]);
    
    if (tracks.length > 0) {
        // Increment usage count
        await this.updateOne({ _id: tracks[0]._id }, { $inc: { usageCount: 1 } });
        return tracks[0];
    }
    
    return null;
};

module.exports = mongoose.model('BackgroundMusic', backgroundMusicSchema);
