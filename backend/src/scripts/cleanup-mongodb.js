require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Book = require('../models/Book');
const Page = require('../models/Page');
const Category = require('../models/Category');
const TTSCache = require('../models/TTSCache');
const Playlist = require('../models/Playlist');

/**
 * MongoDB Cleanup Script
 * 
 * This script:
 * 1. Removes orphaned pages (pages without valid bookId)
 * 2. Removes orphaned TTS cache entries
 * 3. Ensures all books have valid categoryId references
 * 4. Removes duplicate entries
 * 5. Adds missing indexes
 * 6. Reports on data integrity
 */

async function cleanupMongoDB() {
    console.log('🧹 Starting MongoDB cleanup...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const stats = {
            orphanedPages: 0,
            orphanedTTSCache: 0,
            booksWithoutCategory: 0,
            duplicatePages: 0,
            totalBooks: 0,
            totalPages: 0,
            totalCategories: 0
        };

        // 1. Get all books
        const books = await Book.find({});
        stats.totalBooks = books.length;
        console.log(`📚 Found ${books.length} books\n`);

        const bookIds = books.map(b => b._id.toString());

        // 2. Find and remove orphaned pages
        console.log('🔍 Checking for orphaned pages...');
        const allPages = await Page.find({});
        stats.totalPages = allPages.length;

        const orphanedPages = allPages.filter(page => {
            const bookIdStr = page.bookId ? page.bookId.toString() : null;
            return !bookIdStr || !bookIds.includes(bookIdStr);
        });

        if (orphanedPages.length > 0) {
            console.log(`⚠️  Found ${orphanedPages.length} orphaned pages`);
            for (const page of orphanedPages) {
                console.log(`   - Page ${page.pageNumber} (bookId: ${page.bookId})`);
            }

            const orphanedIds = orphanedPages.map(p => p._id);
            await Page.deleteMany({ _id: { $in: orphanedIds } });
            stats.orphanedPages = orphanedPages.length;
            console.log(`✅ Removed ${orphanedPages.length} orphaned pages\n`);
        } else {
            console.log('✅ No orphaned pages found\n');
        }

        // 3. Find duplicate pages (same bookId and pageNumber)
        console.log('🔍 Checking for duplicate pages...');
        const pageGroups = {};

        const remainingPages = await Page.find({});
        for (const page of remainingPages) {
            const key = `${page.bookId}_${page.pageNumber}`;
            if (!pageGroups[key]) {
                pageGroups[key] = [];
            }
            pageGroups[key].push(page);
        }

        for (const [key, pages] of Object.entries(pageGroups)) {
            if (pages.length > 1) {
                console.log(`⚠️  Found ${pages.length} pages for ${key}`);
                // Keep the most recently updated one
                pages.sort((a, b) => b.updatedAt - a.updatedAt);
                const toDelete = pages.slice(1);

                for (const page of toDelete) {
                    await Page.deleteOne({ _id: page._id });
                    stats.duplicatePages++;
                    console.log(`   - Removed duplicate page ${page._id}`);
                }
            }
        }

        if (stats.duplicatePages > 0) {
            console.log(`✅ Removed ${stats.duplicatePages} duplicate pages\n`);
        } else {
            console.log('✅ No duplicate pages found\n');
        }

        // 4. Check categories
        console.log('🔍 Checking categories...');
        const categories = await Category.find({});
        stats.totalCategories = categories.length;
        console.log(`📂 Found ${categories.length} categories`);

        const categoryIds = categories.map(c => c._id.toString());

        // 5. Find books without valid category
        console.log('\n🔍 Checking books for valid categories...');
        let defaultCategory = await Category.findOne({ name: 'Uncategorized' });

        if (!defaultCategory) {
            console.log('📝 Creating default "Uncategorized" category...');
            defaultCategory = await Category.create({
                name: 'Uncategorized',
                description: 'Books without a specific category',
                color: '#6366f1'
            });
            console.log('✅ Created default category\n');
        }

        for (const book of books) {
            const categoryIdStr = book.categoryId ? book.categoryId.toString() : null;

            if (!categoryIdStr || !categoryIds.includes(categoryIdStr)) {
                console.log(`⚠️  Book "${book.title}" has invalid category: ${book.categoryId}`);
                book.categoryId = defaultCategory._id;
                await book.save();
                stats.booksWithoutCategory++;
                console.log(`   ✅ Assigned to "Uncategorized"`);
            }
        }

        if (stats.booksWithoutCategory > 0) {
            console.log(`\n✅ Fixed ${stats.booksWithoutCategory} books with invalid categories\n`);
        } else {
            console.log('✅ All books have valid categories\n');
        }

        // 6. Clean up TTS cache (no time-based expiry - only remove invalid entries)
        console.log('🔍 Checking TTS cache...');
        const ttsEntries = await TTSCache.find({});
        console.log(`🎵 Found ${ttsEntries.length} TTS cache entries`);

        // Remove only entries with missing audio URLs. Do not delete by createdAt/age.
        const invalidTTS = ttsEntries.filter(entry => !entry.audioUrl);
        if (invalidTTS.length > 0) {
            const invalidIds = invalidTTS.map(e => e._id);
            await TTSCache.deleteMany({ _id: { $in: invalidIds } });
            stats.orphanedTTSCache = invalidTTS.length;
            console.log(`✅ Removed ${invalidTTS.length} invalid TTS cache entries\n`);
        } else {
            console.log('✅ All TTS cache entries are valid\n');
        }

        // 7. Ensure indexes
        console.log('🔍 Ensuring database indexes...');
        await Book.collection.createIndex({ categoryId: 1 });
        await Page.collection.createIndex({ bookId: 1, pageNumber: 1 }, { unique: true });
        await TTSCache.collection.createIndex({ textHash: 1, voiceId: 1 }, { unique: true });
        console.log('✅ Indexes created/verified\n');

        // 8. Final report
        console.log('\n' + '='.repeat(60));
        console.log('📊 CLEANUP SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Books:              ${stats.totalBooks}`);
        console.log(`Total Pages:              ${stats.totalPages}`);
        console.log(`Total Categories:         ${stats.totalCategories}`);
        console.log(`Orphaned Pages Removed:   ${stats.orphanedPages}`);
        console.log(`Duplicate Pages Removed:  ${stats.duplicatePages}`);
        console.log(`Books Fixed (Category):   ${stats.booksWithoutCategory}`);
        console.log(`Invalid TTS Removed:      ${stats.orphanedTTSCache}`);
        console.log('='.repeat(60));

        // 9. Verify data integrity
        console.log('\n🔍 Verifying data integrity...');
        const finalPages = await Page.find({});
        const finalBooks = await Book.find({});

        let allValid = true;
        for (const page of finalPages) {
            const bookExists = finalBooks.some(b => b._id.toString() === page.bookId.toString());
            if (!bookExists) {
                console.log(`❌ Page ${page._id} references non-existent book ${page.bookId}`);
                allValid = false;
            }
        }

        for (const book of finalBooks) {
            // Refetch categories to include the newly created default category
            const allCategories = await Category.find({});
            if (book.categoryId) {
                const categoryExists = allCategories.some(c => c._id.toString() === book.categoryId.toString());
                if (!categoryExists) {
                    console.log(`❌ Book ${book._id} references non-existent category ${book.categoryId}`);
                    allValid = false;
                }
            } else {
                console.log(`⚠️  Book ${book._id} has no categoryId`);
            }
        }

        if (allValid) {
            console.log('✅ All data integrity checks passed!\n');
        } else {
            console.log('⚠️  Some integrity issues found (see above)\n');
        }

        console.log('✅ MongoDB cleanup complete!\n');

    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    cleanupMongoDB()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { cleanupMongoDB };
