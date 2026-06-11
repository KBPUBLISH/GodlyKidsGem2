require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { bucket } = require('../config/storage');
const { processCoverImage, toWebpPath } = require('../utils/imageProcessing');

// Models that hold cover URLs we want to optimize.
const Book = require('../models/Book');
const Playlist = require('../models/Playlist');

// Optional models (loaded defensively so the script still runs if any is absent).
const optionalModels = {};
for (const name of ['BookSeries', 'HubPlaylist', 'UserPlaylist', 'KaraokeSong']) {
    try {
        optionalModels[name] = require(`../models/${name}`);
    } catch { /* model not present, skip */ }
}

const DRY_RUN = process.argv.includes('--dry-run');
const LONG_CACHE = 'public, max-age=31536000, immutable';
const uploadsDir = path.join(__dirname, '../../uploads');

const stats = {
    scanned: 0,
    optimized: 0,
    skippedExternal: 0,
    skippedAlreadyWebp: 0,
    skippedEmpty: 0,
    errors: 0,
    bytesBefore: 0,
    bytesAfter: 0,
};

// Pull the GCS object path out of a public URL (only for OUR bucket).
const gcsPathFromUrl = (url) => {
    if (!url || !bucket?.name) return null;
    const marker = `https://storage.googleapis.com/${bucket.name}/`;
    if (url.startsWith(marker)) return url.slice(marker.length);
    const m = url.match(/storage\.googleapis\.com\/([^/]+)\/(.+)$/i);
    if (m && m[1] === bucket.name) return m[2];
    return null;
};

const localPathFromUrl = (url) => {
    const idx = String(url || '').indexOf('/uploads/');
    return idx >= 0 ? url.slice(idx + '/uploads/'.length) : null;
};

const downloadBuffer = async (url) => {
    const gcsPath = gcsPathFromUrl(url);
    if (gcsPath && bucket) {
        const [buf] = await bucket.file(gcsPath).download();
        return { buffer: buf, source: 'gcs', sourcePath: gcsPath };
    }
    const localRel = localPathFromUrl(url);
    if (localRel) {
        const buf = await fs.promises.readFile(path.join(uploadsDir, localRel));
        return { buffer: buf, source: 'local', sourcePath: localRel };
    }
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    return { buffer: Buffer.from(resp.data), source: 'http', sourcePath: null };
};

const uploadVariantsToGcs = async (variants) => {
    await Promise.all(
        variants.map(
            (v) =>
                new Promise((resolve, reject) => {
                    const blob = bucket.file(v.path);
                    const stream = blob.createWriteStream({
                        metadata: { contentType: v.contentType, cacheControl: LONG_CACHE },
                        resumable: false,
                    });
                    stream.on('error', reject);
                    stream.on('finish', resolve);
                    stream.end(v.buffer);
                })
        )
    );
};

const uploadVariantsLocally = async (variants) => {
    for (const v of variants) {
        const dest = path.join(uploadsDir, v.path);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await fs.promises.writeFile(dest, v.buffer);
    }
};

/**
 * Optimize a single cover URL.
 * @returns {Promise<string|null>} the new full WebP URL, or null if unchanged/skipped.
 */
const optimizeCoverUrl = async (url, label) => {
    if (!url || !url.trim()) { stats.skippedEmpty++; return null; }
    stats.scanned++;

    if (/\.webp($|\?)/i.test(url)) { stats.skippedAlreadyWebp++; return null; }

    const gcsPath = gcsPathFromUrl(url);
    const localRel = localPathFromUrl(url);
    if (!gcsPath && !localRel) { stats.skippedExternal++; return null; }

    const sourcePath = gcsPath || localRel;
    const newPath = toWebpPath(sourcePath);

    try {
        const { buffer } = await downloadBuffer(url);
        const variants = await processCoverImage(buffer, newPath);
        const fullVariant = variants.find((v) => v.variant === 'full');

        stats.bytesBefore += buffer.length;
        stats.bytesAfter += fullVariant.buffer.length;

        const newUrl = gcsPath
            ? `https://storage.googleapis.com/${bucket.name}/${fullVariant.path}`
            : url.replace(`/uploads/${sourcePath}`, `/uploads/${fullVariant.path}`);

        if (DRY_RUN) {
            console.log(`  [dry-run] ${label}: ${(buffer.length / 1024).toFixed(0)}KB -> ${(fullVariant.buffer.length / 1024).toFixed(0)}KB  ${newUrl}`);
        } else {
            if (gcsPath) await uploadVariantsToGcs(variants);
            else await uploadVariantsLocally(variants);
            console.log(`  ✅ ${label}: ${(buffer.length / 1024).toFixed(0)}KB -> ${(fullVariant.buffer.length / 1024).toFixed(0)}KB`);
        }
        stats.optimized++;
        return newUrl;
    } catch (err) {
        stats.errors++;
        console.warn(`  ⚠️ ${label}: failed (${err.message})`);
        return null;
    }
};

const backfillBooks = async () => {
    console.log('\n📚 Books...');
    const books = await Book.find({}).select('_id title coverImage files');
    for (const book of books) {
        const current = (book.files && book.files.coverImage) || book.coverImage;
        const newUrl = await optimizeCoverUrl(current, `Book "${book.title}"`);
        if (newUrl && !DRY_RUN) {
            if (!book.files) book.files = {};
            book.files.coverImage = newUrl;
            book.coverImage = newUrl;
            await book.save();
        }
    }
};

const backfillPlaylists = async () => {
    console.log('\n🎧 Playlists (covers + items)...');
    const playlists = await Playlist.find({});
    for (const pl of playlists) {
        let changed = false;
        const newCover = await optimizeCoverUrl(pl.coverImage, `Playlist "${pl.title}"`);
        if (newCover && !DRY_RUN) { pl.coverImage = newCover; changed = true; }

        for (const item of pl.items || []) {
            const newItemCover = await optimizeCoverUrl(item.coverImage, `  item "${item.title}"`);
            if (newItemCover && !DRY_RUN) { item.coverImage = newItemCover; changed = true; }
        }
        if (changed && !DRY_RUN) await pl.save();
    }
};

const backfillSimpleCoverModel = async (Model, name) => {
    if (!Model) return;
    console.log(`\n📦 ${name}...`);
    const docs = await Model.find({});
    for (const doc of docs) {
        if (typeof doc.coverImage === 'undefined') continue;
        const newUrl = await optimizeCoverUrl(doc.coverImage, `${name} ${doc._id}`);
        if (newUrl && !DRY_RUN) { doc.coverImage = newUrl; await doc.save(); }
    }
};

async function run() {
    if (!bucket && !fs.existsSync(uploadsDir)) {
        console.error('❌ Neither GCS bucket nor local uploads dir available. Aborting.');
        process.exit(1);
    }

    console.log(`🚀 Cover WebP backfill ${DRY_RUN ? '(DRY RUN)' : ''}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    try {
        await backfillBooks();
        await backfillPlaylists();
        await backfillSimpleCoverModel(optionalModels.BookSeries, 'BookSeries');
        await backfillSimpleCoverModel(optionalModels.HubPlaylist, 'HubPlaylist');
        await backfillSimpleCoverModel(optionalModels.UserPlaylist, 'UserPlaylist');
        await backfillSimpleCoverModel(optionalModels.KaraokeSong, 'KaraokeSong');
    } finally {
        await mongoose.disconnect();
    }

    const saved = stats.bytesBefore - stats.bytesAfter;
    const pct = stats.bytesBefore > 0 ? ((saved / stats.bytesBefore) * 100).toFixed(1) : '0';
    console.log('\n' + '='.repeat(50));
    console.log('📊 BACKFILL REPORT');
    console.log('='.repeat(50));
    console.log(`Scanned:               ${stats.scanned}`);
    console.log(`Optimized:             ${stats.optimized}`);
    console.log(`Skipped (external):    ${stats.skippedExternal}`);
    console.log(`Skipped (already webp):${stats.skippedAlreadyWebp}`);
    console.log(`Skipped (empty):       ${stats.skippedEmpty}`);
    console.log(`Errors:                ${stats.errors}`);
    console.log(`Size:                  ${(stats.bytesBefore / 1024 / 1024).toFixed(2)}MB -> ${(stats.bytesAfter / 1024 / 1024).toFixed(2)}MB (saved ${pct}%)`);
    console.log('='.repeat(50));
    if (DRY_RUN) console.log('ℹ️  Dry run only — no files written, no DB changes made.');
}

if (require.main === module) {
    run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { optimizeCoverUrl };
