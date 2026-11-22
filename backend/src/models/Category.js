const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
    },
    color: {
        type: String,
        default: '#6366f1', // Default indigo color
    },
    // Gradient color option (from-to format for Tailwind)
    gradientFrom: {
        type: String,
        default: '#6366f1', // Start color
    },
    gradientTo: {
        type: String,
        default: '#8b5cf6', // End color
    },
    icon: {
        type: String, // Icon name or emoji
    },
    // Square icon image shown as the category icon in the app
    iconImage: {
        type: String, // URL to GCS
    },
    // Category cover image for the app cards
    image: {
        type: String, // URL to GCS
    },
    // Category type: determines where this category appears in the app
    // 'Book' = Read page, 'Audio' = Listen page
    // Note: Not required to support legacy categories that don't have this field
    contentType: {
        type: String,
        enum: ['Book', 'Audio', null],
        default: 'Book',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

categorySchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// Same display name can exist once per library (Read vs Listen).
categorySchema.index({ name: 1, contentType: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

const isMissingIndexError = (err) =>
    err?.code === 27 || err?.codeName === 'IndexNotFound';

const dropLegacyNameIndex = async () => {
    try {
        const indexes = await Category.collection.indexes();
        const legacy = indexes.find((idx) => {
            if (idx.name === 'name_1') return true;
            const keys = idx.key || {};
            return idx.unique && keys.name === 1 && keys.contentType == null;
        });
        if (!legacy) return false;
        await Category.collection.dropIndex(legacy.name);
        console.log(`📚 Dropped legacy Category index ${legacy.name} so Read and Listen can share names`);
        return true;
    } catch (err) {
        if (!isMissingIndexError(err)) {
            console.warn('Category name index drop:', err.message);
        }
        return false;
    }
};

const whenReady = (fn) => {
    if (mongoose.connection.readyState === 1) {
        fn();
        return;
    }
    mongoose.connection.once('open', fn);
};

whenReady(() => {
    dropLegacyNameIndex();
});

Category.dropLegacyNameIndex = dropLegacyNameIndex;

module.exports = Category;
