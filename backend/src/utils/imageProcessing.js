const sharp = require('sharp');
const path = require('path');

// Cover variants. The "full" variant keeps the canonical path (no suffix) so
// existing cover URLs keep working; the "thumb" variant uses a predictable
// `_thumb` suffix so the frontend can derive its URL from the full URL without
// any schema/DB changes.
const COVER_VARIANTS = {
    full: { maxSize: 1000, quality: 80, suffix: '' },
    thumb: { maxSize: 400, quality: 70, suffix: '_thumb' },
};

const THUMB_SUFFIX = COVER_VARIANTS.thumb.suffix; // '_thumb'

// Insert a variant suffix before the file extension.
// e.g. ('books/x/cover/123_a.webp', '_thumb') -> 'books/x/cover/123_a_thumb.webp'
const withSuffix = (filePath, suffix) => {
    if (!suffix) return filePath;
    const ext = path.extname(filePath);
    const base = filePath.slice(0, filePath.length - ext.length);
    return `${base}${suffix}${ext}`;
};

// Convert any cover filePath to its .webp equivalent (keeps the folder + name,
// swaps the extension).
const toWebpPath = (filePath) => {
    const ext = path.extname(filePath);
    if (ext.toLowerCase() === '.webp') return filePath;
    return `${filePath.slice(0, filePath.length - ext.length)}.webp`;
};

/**
 * Process a raw image buffer into optimized WebP variants.
 *
 * @param {Buffer} buffer Raw uploaded image bytes.
 * @param {string} basePath The GCS/local path for the full cover (should end .webp).
 * @returns {Promise<Array<{ path: string, buffer: Buffer, contentType: string, variant: string }>>}
 */
const processCoverImage = async (buffer, basePath) => {
    const webpPath = toWebpPath(basePath);
    // failOn: 'none' makes sharp tolerant of slightly malformed files.
    // rotate() applies EXIF orientation so portrait photos aren't sideways.
    const base = sharp(buffer, { failOn: 'none', animated: false }).rotate();

    const outputs = [];
    for (const [variant, cfg] of Object.entries(COVER_VARIANTS)) {
        const out = await base
            .clone()
            .resize({
                width: cfg.maxSize,
                height: cfg.maxSize,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: cfg.quality, effort: 4 })
            .toBuffer();

        outputs.push({
            path: withSuffix(webpPath, cfg.suffix),
            buffer: out,
            contentType: 'image/webp',
            variant,
        });
    }
    return outputs;
};

module.exports = {
    COVER_VARIANTS,
    THUMB_SUFFIX,
    withSuffix,
    toWebpPath,
    processCoverImage,
};
