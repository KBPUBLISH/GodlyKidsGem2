const sharp = require('sharp');

/** Kid-friendly default palette for tap-to-fill MVP */
const DEFAULT_PALETTE = [
    '#E74C3C',
    '#E67E22',
    '#F1C40F',
    '#2ECC71',
    '#3498DB',
    '#9B59B6',
    '#E91E63',
    '#1ABC9C',
    '#FFFFFF',
    '#8D6E63',
];

const MAX_DIM = 900;
const MIN_REGION_AREA = 48;
/** Luminance below this = black outline / ink */
const INK_THRESHOLD = 140;

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

/**
 * Binarize line art + 4-connected component labeling → region ID map.
 * Region map PNG encodes id in R + (G<<8); A=255 for fillable, A=0 for ink.
 *
 * @param {Buffer} inputBuffer
 * @param {{ maxDim?: number, minRegionArea?: number, palette?: string[] }} [options]
 */
async function segmentLineArt(inputBuffer, options = {}) {
    const maxDim = options.maxDim ?? MAX_DIM;
    const minArea = options.minRegionArea ?? MIN_REGION_AREA;
    const palette =
        Array.isArray(options.palette) && options.palette.length > 0
            ? options.palette.map(String)
            : DEFAULT_PALETTE.slice();

    const { data, info } = await sharp(inputBuffer)
        .ensureAlpha()
        .resize({
            width: maxDim,
            height: maxDim,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const pixelCount = width * height;

    const mask = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        const o = i * channels;
        const a = channels === 4 ? data[o + 3] / 255 : 1;
        const lum =
            (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a +
            255 * (1 - a);
        mask[i] = lum >= INK_THRESHOLD ? 1 : 0;
    }

    const labels = new Int32Array(pixelCount);
    let nextLabel = 1;
    const areas = new Map();
    const queue = new Int32Array(pixelCount);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const start = y * width + x;
            if (!mask[start] || labels[start]) continue;

            const label = nextLabel++;
            let area = 0;
            let qh = 0;
            let qt = 0;
            queue[qt++] = start;
            labels[start] = label;

            while (qh < qt) {
                const cur = queue[qh++];
                area += 1;
                const cx = cur % width;
                const cy = (cur / width) | 0;
                const neighbors = [
                    cy > 0 ? cur - width : -1,
                    cy < height - 1 ? cur + width : -1,
                    cx > 0 ? cur - 1 : -1,
                    cx < width - 1 ? cur + 1 : -1,
                ];
                for (const n of neighbors) {
                    if (n < 0 || !mask[n] || labels[n]) continue;
                    labels[n] = label;
                    queue[qt++] = n;
                }
            }
            areas.set(label, area);
        }
    }

    const keep = new Map();
    let newId = 1;
    const sorted = [...areas.entries()].sort((a, b) => b[1] - a[1]);
    for (const [label, area] of sorted) {
        if (area < minArea) continue;
        keep.set(label, newId++);
    }
    const regionCount = newId - 1;

    const regionMap = Buffer.alloc(pixelCount * 4);
    const preview = Buffer.alloc(pixelCount * 4);
    const regionColors = new Map();
    for (let id = 1; id <= regionCount; id++) {
        const hue = (id * 47) % 360;
        regionColors.set(id, hslToRgb(hue, 0.55, 0.72));
    }

    for (let i = 0; i < pixelCount; i++) {
        const o = i * 4;
        const old = labels[i];
        const id = old ? keep.get(old) || 0 : 0;

        if (!mask[i] || !id) {
            regionMap[o] = 0;
            regionMap[o + 1] = 0;
            regionMap[o + 2] = 0;
            regionMap[o + 3] = 0;
            if (!mask[i]) {
                preview[o] = 24;
                preview[o + 1] = 24;
                preview[o + 2] = 24;
            } else {
                preview[o] = 255;
                preview[o + 1] = 255;
                preview[o + 2] = 255;
            }
            preview[o + 3] = 255;
        } else {
            regionMap[o] = id & 0xff;
            regionMap[o + 1] = (id >> 8) & 0xff;
            regionMap[o + 2] = 0;
            regionMap[o + 3] = 255;
            const [r, g, b] = regionColors.get(id);
            preview[o] = r;
            preview[o + 1] = g;
            preview[o + 2] = b;
            preview[o + 3] = 255;
        }
    }

    const [lineArtPng, regionMapPng, regionPreviewPng] = await Promise.all([
        sharp(inputBuffer)
            .resize({
                width: maxDim,
                height: maxDim,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .png()
            .toBuffer(),
        sharp(regionMap, { raw: { width, height, channels: 4 } }).png().toBuffer(),
        sharp(preview, { raw: { width, height, channels: 4 } }).png().toBuffer(),
    ]);

    return {
        width,
        height,
        regionCount,
        palette,
        lineArtPng,
        regionMapPng,
        regionPreviewPng,
        minRegionArea: minArea,
    };
}

/** Decode region id from region-map RGBA pixel */
function decodeRegionId(r, g, a) {
    if (!a) return 0;
    return (r & 0xff) + ((g & 0xff) << 8);
}

module.exports = {
    DEFAULT_PALETTE,
    segmentLineArt,
    decodeRegionId,
};
