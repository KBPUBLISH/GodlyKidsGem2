const crypto = require('crypto');
const axios = require('axios');
const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const MonthlyBookTemplate = require('../models/MonthlyBookTemplate');
const SavedCharacter = require('../models/SavedCharacter');
const Book = require('../models/Book');
const Page = require('../models/Page');
const { sendNotificationToUser } = require('../services/notificationService');
const { bucket } = require('../config/storage');

const PLACEHOLDER_PAGE_IMAGE = 'https://picsum.photos/seed/story/800/600';

/** Cached Google auth token for Imagen (reused across page generations) */
let _imagenToken = null;
let _imagenTokenExpiry = 0;

async function getImagenAccessToken() {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) return null;
    if (_imagenToken && Date.now() < _imagenTokenExpiry - 60000) return _imagenToken;
    try {
        const credentials = JSON.parse(credentialsJson);
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        _imagenToken = tokenResponse.token;
        _imagenTokenExpiry = Date.now() + (tokenResponse.res?.data?.expiry_date || 3600 * 1000);
        return _imagenToken;
    } catch (err) {
        console.error('MonthlyBookGenerator: getImagenAccessToken error', err.message);
        return null;
    }
}

/**
 * Substitute {childName} in template text.
 */
function substituteChildName(text, childName) {
    if (!text || !childName) return text || '';
    return String(text).replace(/\{childName\}/g, childName);
}

/**
 * Recursively substitute {childName} in any string values (e.g. content.text, textBoxes[].text).
 */
function substituteChildNameInPage(pageDoc, childName) {
    const out = JSON.parse(JSON.stringify(pageDoc));
    if (out.content?.text) out.content.text = substituteChildName(out.content.text, childName);
    if (Array.isArray(out.content?.textBoxes)) {
        out.content.textBoxes = out.content.textBoxes.map((box) => ({
            ...box,
            text: substituteChildName(box.text, childName),
        }));
    }
    return out;
}

/**
 * Generate one page image for template-based flow (stub: returns placeholder).
 */
async function generatePageImage(_customBook, _templatePage, _bibleCharacter, _pageIndex) {
    return PLACEHOLDER_PAGE_IMAGE;
}

/**
 * Expand @CharacterName or @internalTag in the Image prompt (sceneDescription) to inject
 * saved character style. @kid (or @child) references the child's avatar. Used only in the prompt field;
 * text block keeps @ for voice, [] for ElevenLabs, {} for {childName}.
 * Returns { text, stylePrompts, hasKidReference }.
 */
async function expandAtReferencesInScene(sceneDescription, referenceCharacterIds, childName) {
    let text = substituteChildName((sceneDescription || '').trim(), childName);
    const stylePrompts = [];
    let hasKidReference = false;
    const atTagRegex = /@([A-Za-z0-9_]+)/g;
    const tags = [];
    let m;
    while ((m = atTagRegex.exec(sceneDescription || '')) !== null) {
        if (!tags.includes(m[1])) tags.push(m[1]);
    }

    // @kid / @child -> child's avatar; replace with child name and flag for reference image
    const kidTags = tags.filter((t) => t.toLowerCase() === 'kid' || t.toLowerCase() === 'child');
    if (kidTags.length > 0) {
        hasKidReference = true;
        const name = childName || 'the child';
        kidTags.forEach((tag) => {
            text = text.replace(new RegExp('@' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), name);
        });
    }
    const savedCharTags = tags.filter((t) => t.toLowerCase() !== 'kid' && t.toLowerCase() !== 'child');
    if (savedCharTags.length === 0) return { text, stylePrompts, hasKidReference };

    const refIds = (referenceCharacterIds || []).filter(Boolean);
    const pageChars = refIds.length
        ? await SavedCharacter.find({ _id: { $in: refIds } }).select('_id displayName internalTag stylePrompt').lean()
        : [];
    const byDisplayName = new Map(pageChars.map((c) => [c.displayName.toLowerCase(), c]));
    const byInternalTag = new Map(pageChars.map((c) => [c.internalTag.toLowerCase(), c]));

    if (pageChars.length === 0 || savedCharTags.some((t) => !byDisplayName.has(t.toLowerCase()) && !byInternalTag.has(t.toLowerCase()))) {
        const allActive = await SavedCharacter.find({ status: 'active' }).select('displayName internalTag stylePrompt').lean();
        allActive.forEach((c) => {
            if (!byDisplayName.has(c.displayName.toLowerCase())) byDisplayName.set(c.displayName.toLowerCase(), c);
            if (!byInternalTag.has(c.internalTag.toLowerCase())) byInternalTag.set(c.internalTag.toLowerCase(), c);
        });
    }

    const used = new Set();
    savedCharTags.forEach((tag) => {
        const lower = tag.toLowerCase();
        const char = byInternalTag.get(lower) || byDisplayName.get(lower);
        if (char && char.stylePrompt && !used.has(char.displayName)) {
            used.add(char.displayName);
            stylePrompts.push(char.stylePrompt);
        }
        const displayName = char ? char.displayName : tag;
        text = text.replace(new RegExp('@' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), displayName);
    });

    return { text, stylePrompts, hasKidReference };
}

/**
 * Build scene prompt from page.sceneDescription or page content text + character style.
 * When sceneDescription is set, @Name is expanded to saved character style; @kid/@child flags the child's avatar for reference image.
 * Returns { prompt, hasKidReference }.
 */
async function buildScenePrompt(pageDoc, characterStylePrompt, childName) {
    const scene = (pageDoc.sceneDescription || '').trim();
    if (scene) {
        const { text: expandedScene, stylePrompts, hasKidReference } = await expandAtReferencesInScene(
            pageDoc.sceneDescription,
            pageDoc.referenceCharacterIds,
            childName
        );
        const allStyles = [characterStylePrompt, ...stylePrompts].filter(Boolean);
        const styleBlock = allStyles.join('. ');
        const prompt = `${expandedScene}. ${styleBlock}. Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image.`;
        return { prompt, hasKidReference };
    }
    const text = pageDoc.content?.text || '';
    const fromBoxes = (pageDoc.content?.textBoxes || []).map((b) => b.text).filter(Boolean).join(' ');
    const combined = (text + ' ' + fromBoxes).trim().slice(0, 200);
    const context = substituteChildName(combined, childName) || 'A gentle storybook scene';
    const prompt = `Scene for a children's story: ${context}. ${characterStylePrompt}. Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image.`;
    return { prompt, hasKidReference: false };
}

/**
 * Gather all reference images for a page: child character + portal characters (SavedCharacter with referenceImageUrl).
 * Returns [{ base64, label }] in order: child first (if present), then portal characters by referenceCharacterIds.
 */
async function gatherPageReferenceImages(customBook, pageDoc) {
    const refs = [];
    if (customBook.childCharacterImageUrl) {
        const childBase64 = await fetchImageAsBase64(customBook.childCharacterImageUrl);
        if (childBase64) {
            refs.push({ base64: childBase64, label: 'the child' });
        }
    }
    const refIds = (pageDoc.referenceCharacterIds || []).filter(Boolean);
    if (refIds.length) {
        const savedChars = await SavedCharacter.find({ _id: { $in: refIds } })
            .select('displayName referenceImageUrl')
            .lean();
        for (const char of savedChars) {
            if (char.referenceImageUrl) {
                const base64 = await fetchImageAsBase64(char.referenceImageUrl);
                if (base64) {
                    refs.push({ base64, label: char.displayName || 'character' });
                }
            }
        }
    }
    return refs;
}

/**
 * Generate one page image with Vertex Gemini 2.5 Flash Image for all pages (superior consistency).
 * Uses child + portal character reference images when available; supports text-only when no refs.
 * Returns GCS URL or null on failure (caller retries; no Imagen fallback).
 */
async function generatePageImageWithVertexGemini(customBook, pageDoc, characterStylePrompt, pageIndex) {
    const customMonthlyBookId = String(customBook._id);
    const pageNumber = pageIndex + 1;
    const token = await getImagenAccessToken();
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let projectId = null;
    try {
        projectId = credentialsJson ? JSON.parse(credentialsJson).project_id : null;
    } catch (_) {}
    if (!token || !projectId || !bucket) return null;

    const { prompt } = await buildScenePrompt(pageDoc, characterStylePrompt, customBook.childName);
    const referenceImages = await gatherPageReferenceImages(customBook, pageDoc);

    const refDescription = referenceImages.length
        ? referenceImages.map((r, i) => `Image ${i + 1}: ${r.label}`).join('. ')
        : '';
    const geminiPrompt = referenceImages.length
        ? `Using the provided reference images (${refDescription}), generate one image: ${prompt} Place each character in the scene as described. Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image. Vertical 9:16 composition.`
        : `Generate one image: ${prompt} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image. Vertical 9:16 composition.`;

    const parts = [{ text: geminiPrompt }];
    for (const ref of referenceImages) {
        parts.push({ inlineData: { mimeType: 'image/png', data: ref.base64 } });
    }

    try {
        const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`;
        const res = await axios.post(
            url,
            {
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio: '9:16' },
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                timeout: 60000,
                validateStatus: () => true,
            }
        );
        if (res.status !== 200) {
            console.warn('MonthlyBookGenerator: Gemini page', pageNumber, 'failed', res.status, typeof res.data === 'string' ? res.data.slice(0, 150) : '');
            return null;
        }
        const outParts = res.data.candidates?.[0]?.content?.parts || [];
        let imageBase64 = null;
        for (const part of outParts) {
            if (part.inlineData && part.inlineData.data) {
                imageBase64 = part.inlineData.data;
                break;
            }
        }
        if (!imageBase64) {
            console.warn('MonthlyBookGenerator: Gemini page', pageNumber, 'returned no image');
            return null;
        }
        const buffer = Buffer.from(imageBase64, 'base64');
        const hash = crypto.createHash('md5').update(customMonthlyBookId + pageNumber + Date.now()).digest('hex').slice(0, 8);
        const filename = `monthly-books/${customMonthlyBookId}/page-${pageNumber}-${hash}.png`;
        const blob = bucket.file(filename);
        await blob.save(buffer, {
            metadata: { contentType: 'image/png', cacheControl: 'public, max-age=86400' },
        });
        await blob.makePublic().catch(() => {});
        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        console.log('MonthlyBookGenerator: Generated page', pageNumber, 'with Vertex Gemini 2.5 Flash Image', imageUrl);
        return imageUrl;
    } catch (err) {
        console.warn('MonthlyBookGenerator: Gemini page', pageNumber, 'error', err.message);
        return null;
    }
}

/** Number of Gemini attempts per page before failing (no Imagen fallback). */
const PAGE_GEMINI_MAX_ATTEMPTS = 3;

/** Delay in ms between Gemini retries for page generation. */
const PAGE_GEMINI_RETRY_DELAY_MS = 2000;

/**
 * Generate one page background image for Book-based flow. Gemini 2.5 Flash only; retries up to PAGE_GEMINI_MAX_ATTEMPTS.
 * No Imagen fallback. Uses page.sceneDescription or page text + character style; uploads to GCS and returns URL.
 * Throws if all Gemini attempts fail or credentials/GCS missing.
 */
async function generatePageImageForBook(customBook, pageDoc, characterStylePrompt, pageIndex) {
    const pageNumber = pageIndex + 1;
    const token = await getImagenAccessToken();
    if (!token) {
        throw new Error('GCP credentials not configured (GCS_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_JSON). Cannot generate page ' + pageNumber + '.');
    }
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let projectId = null;
    try {
        projectId = credentialsJson ? JSON.parse(credentialsJson).project_id : null;
    } catch (_) {}
    if (!projectId) {
        throw new Error('GCP project_id not found in credentials. Cannot generate page ' + pageNumber + '.');
    }
    if (!bucket) {
        throw new Error('GCS bucket not configured (GCS_BUCKET_NAME). Cannot upload page ' + pageNumber + ' image.');
    }

    let lastError = null;
    for (let attempt = 1; attempt <= PAGE_GEMINI_MAX_ATTEMPTS; attempt++) {
        const geminiUrl = await generatePageImageWithVertexGemini(customBook, pageDoc, characterStylePrompt, pageIndex);
        if (geminiUrl) return geminiUrl;
        if (attempt < PAGE_GEMINI_MAX_ATTEMPTS) {
            console.log('MonthlyBookGenerator: Gemini page', pageNumber, 'attempt', attempt, 'failed; retrying in', PAGE_GEMINI_RETRY_DELAY_MS, 'ms...');
            await new Promise((r) => setTimeout(r, PAGE_GEMINI_RETRY_DELAY_MS));
        }
    }
    throw new Error('Page ' + pageNumber + ': Gemini 2.5 Flash Image failed after ' + PAGE_GEMINI_MAX_ATTEMPTS + ' attempts. No Imagen fallback.');
}

/**
 * Fetch image from URL and return base64 string (for Imagen reference).
 */
async function fetchImageAsBase64(url) {
    if (!url || !url.startsWith('http')) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        if (res.status !== 200 || !res.data) return null;
        return Buffer.from(res.data).toString('base64');
    } catch (err) {
        console.warn('MonthlyBookGenerator: Could not fetch child image for cover', err.message);
        return null;
    }
}

/**
 * Generate book cover image with the kid character and the main Bible/featured character.
 * - If the source book has a cover image (files.coverImage), it is used as REFERENCE_TYPE_STYLE so the
 *   generated cover matches that composition/style and is remade per kid.
 * - If the kid has an avatar (childCharacterImageUrl), it is used as REFERENCE_TYPE_SUBJECT so the child
 *   looks like them. Throws on failure so the book is not created.
 */
async function generateCoverImageForBook(customBook, sourceBook) {
    const customMonthlyBookId = String(customBook._id);
    const token = await getImagenAccessToken();
    if (!token) {
        throw new Error('Imagen credentials not configured. Cannot generate cover.');
    }
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let projectId = null;
    try {
        projectId = credentialsJson ? JSON.parse(credentialsJson).project_id : null;
    } catch (_) {}
    if (!projectId) throw new Error('Imagen project_id not found. Cannot generate cover.');
    if (!bucket) throw new Error('GCS bucket not configured. Cannot upload cover.');

    const character = sourceBook.featuredCharacterId || {};
    const characterName = character.displayName || 'the hero';
    const characterStyle = character.stylePrompt || 'children\'s book illustration style';
    const childName = customBook.childName || 'the child';

    const referenceImages = [];
    let styleRefId = 0;
    let subjectRefId = 0;
    const templateCoverUrl = sourceBook.files?.coverImage || sourceBook.coverImage;
    const templateCoverBase64 = templateCoverUrl ? await fetchImageAsBase64(templateCoverUrl) : null;
    if (templateCoverBase64) {
        styleRefId = 1;
        referenceImages.push({
            referenceId: styleRefId,
            referenceImage: { bytesBase64Encoded: templateCoverBase64 },
            referenceType: 'REFERENCE_TYPE_STYLE',
            styleImageConfig: {
                styleDescription: 'Use this image as the style and composition reference for the book cover. Recreate the same layout and visual style.',
            },
        });
    }
    const childImageBase64 = customBook.childCharacterImageUrl
        ? await fetchImageAsBase64(customBook.childCharacterImageUrl)
        : null;
    if (childImageBase64) {
        subjectRefId = styleRefId + 1;
        referenceImages.push({
            referenceId: subjectRefId,
            referenceImage: { bytesBase64Encoded: childImageBase64 },
            referenceType: 'REFERENCE_TYPE_SUBJECT',
            subjectImageConfig: {
                subjectDescription: `A child named ${childName}, include this child in the scene with ${characterName}`,
                subjectType: 'SUBJECT_TYPE_PERSON',
            },
        });
    }

    const prompt = templateCoverBase64
        ? `Recreate this book cover in the same style and composition. Feature the child [${subjectRefId || 1}] and ${characterName} (${characterStyle}). Children's book illustration, Christian faith theme, ages 4-12, no text in image.`
        : subjectRefId
            ? `Children's book cover: The child [${subjectRefId}] and ${characterName} (${characterStyle}) standing together in a warm, magical storybook scene. Both characters visible and friendly, side by side. Children's book illustration style, Christian faith theme, suitable for ages 4-12, no text in image.`
            : `Children's book cover: A child named ${childName} and ${characterName} (${characterStyle}) standing together in a warm, magical storybook scene. Both characters visible and friendly, side by side. Children's book illustration style, Christian faith theme, suitable for ages 4-12, no text in image.`;

    const instancesPayload = referenceImages.length
        ? { prompt, referenceImages }
        : { prompt };
    // Reference images require the capability model; generate-001 is text-only and mis-handles referenceImages as "editing" (missing media).
    const model = referenceImages.length > 0 ? 'imagen-3.0-capability-001' : 'imagen-3.0-generate-001';
    const response = await axios.post(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:predict`,
        {
            instances: [instancesPayload],
            parameters: {
                sampleCount: 1,
                aspectRatio: '9:16',
                safetyFilterLevel: 'block_some',
                personGeneration: childImageBase64 ? 'allow_all' : 'dont_allow',
            },
        },
        {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            validateStatus: () => true,
        }
    );

    if (response.status !== 200 || !response.data?.predictions?.[0]) {
        const errText = response.status !== 200
            ? (typeof response.data === 'string' ? response.data : JSON.stringify(response.data || {}).slice(0, 300))
            : 'No prediction';
        throw new Error('Imagen cover generation failed: ' + errText);
    }
    const imageBase64 = response.data.predictions[0].bytesBase64Encoded;
    const buffer = Buffer.from(imageBase64, 'base64');
    const hash = crypto.createHash('md5').update(customMonthlyBookId + 'cover' + Date.now()).digest('hex').slice(0, 8);
    const filename = `monthly-books/${customMonthlyBookId}/cover-${hash}.png`;
    const blob = bucket.file(filename);
    await blob.save(buffer, {
        metadata: { contentType: 'image/png', cacheControl: 'public, max-age=86400' },
    });
    await blob.makePublic().catch(() => {});
    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log('MonthlyBookGenerator: Generated cover', url, templateCoverBase64 ? '(from template style)' : '');
    return url;
}

/**
 * Run monthly book generation from a Book Builder book (sourceBookId).
 * Loads Book + Pages, substitutes {childName}, generates background images, creates new Book.
 */
async function runMonthlyBookGenerationFromBook(customMonthlyBookId, custom, sourceBook) {
    const character = sourceBook.featuredCharacterId || {};
    const characterStylePrompt = character.stylePrompt || 'children\'s book illustration style';

    const sourcePages = await Page.find({ bookId: sourceBook._id })
        .sort({ pageNumber: 1 })
        .lean();
    if (!sourcePages.length) {
        throw new Error('Source book has no pages. Add pages in the portal before generating.');
    }
    let pageCount = custom.hasTrialOrPaid
        ? sourcePages.length
        : Math.min(4, sourcePages.length);
    // For testing: set MONTHLY_BOOK_MAX_PAGES_FOR_TESTING=3 (or 1, 2, etc.) to cap pages and save time/Imagen calls
    const testMaxEnv = process.env.MONTHLY_BOOK_MAX_PAGES_FOR_TESTING;
    if (testMaxEnv != null && testMaxEnv !== '') {
        const cap = parseInt(testMaxEnv, 10);
        if (!Number.isNaN(cap) && cap >= 1) pageCount = Math.min(pageCount, cap);
    }
    const pagesToProcess = sourcePages.slice(0, pageCount);

    const bookTitle = substituteChildName(sourceBook.title, custom.childName) || `${custom.childName}'s ${sourceBook.title}`;

    // Use source book's cover when available (consistent, predictable). Otherwise generate with kid + featured character.
    const sourceCoverUrl = sourceBook.files?.coverImage || sourceBook.coverImage;
    const coverUrl = sourceCoverUrl
        ? sourceCoverUrl
        : await generateCoverImageForBook(custom, sourceBook);

    const pages = [];
    for (let i = 0; i < pagesToProcess.length; i++) {
        const pageDoc = pagesToProcess[i];
        const portalPrompt = (pageDoc.sceneDescription || '').trim();
        const hasPortalPrompt = portalPrompt.length > 0;
        const preview = hasPortalPrompt ? ` "${portalPrompt.slice(0, 80)}${portalPrompt.length > 80 ? '...' : ''}"` : '';
        console.log(`MonthlyBookGenerator: Page ${i + 1}/${pagesToProcess.length} ${hasPortalPrompt ? 'using portal scene prompt' : 'using fallback from page text'}${preview}`);
        const pageWithName = substituteChildNameInPage(pageDoc, custom.childName);
        const backgroundUrl = await generatePageImageForBook(
            custom,
            pageDoc,
            characterStylePrompt,
            i
        );
        const pagePayload = {
            pageNumber: i + 1,
            content: pageWithName.content || {},
            files: {
                ...(pageWithName.files || {}),
                background: {
                    url: backgroundUrl,
                    type: pageWithName.files?.background?.type || 'image',
                },
            },
        };
        if (pageWithName.isColoringPage != null) pagePayload.isColoringPage = pageWithName.isColoringPage;
        if (pageWithName.coloringEndModalOnly != null) pagePayload.coloringEndModalOnly = pageWithName.coloringEndModalOnly;
        if (pageWithName.isWebViewPage != null) pagePayload.isWebViewPage = pageWithName.isWebViewPage;
        if (pageWithName.webView) pagePayload.webView = pageWithName.webView;
        pages.push(pagePayload);
    }

    const book = await Book.create({
        title: bookTitle,
        author: sourceBook.author || 'GodlyKids',
        description: substituteChildName(sourceBook.description || `A custom story for ${custom.childName}.`, custom.childName),
        status: 'published',
        bookType: 'standard',
        pages,
        files: {
            coverImage: coverUrl,
            images: [],
            videos: [],
            audio: [],
        },
        showCharacterOverlay: sourceBook.showCharacterOverlay || false,
    });

    // Create Page documents so GET /api/pages/book/:bookId returns them (app reader loads from Page collection)
    const pageDocs = pages.map((p) => ({
        bookId: book._id,
        pageNumber: p.pageNumber,
        content: p.content || {},
        files: p.files || {},
        isColoringPage: p.isColoringPage || false,
        coloringEndModalOnly: p.coloringEndModalOnly !== false,
        isWebViewPage: p.isWebViewPage || false,
        webView: p.webView || {},
    }));
    await Page.insertMany(pageDocs);

    await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
        status: 'completed',
        bookId: book._id,
        notificationSentAt: new Date(),
    });

    const notificationTitle = '✨ Your story is ready!';
    const notificationMessage = `${custom.childName}, your story is ready to read!`;
    await sendNotificationToUser({
        userId: custom.userId,
        title: notificationTitle,
        message: notificationMessage,
        url: `/book/${book._id}`,
        data: { type: 'monthly_book_ready', bookId: String(book._id), customMonthlyBookId: String(customMonthlyBookId) },
    });

    console.log('MonthlyBookGenerator: Completed (from book)', customMonthlyBookId, 'bookId', book._id);
}

/**
 * Run monthly book generation for a single CustomMonthlyBook.
 * If sourceBookId: Book-based flow. Else: template-based flow.
 */
async function runMonthlyBookGeneration(customMonthlyBookId) {
    const custom = await CustomMonthlyBook.findById(customMonthlyBookId)
        .populate('templateId')
        .lean();
    if (!custom) {
        console.error('MonthlyBookGenerator: CustomMonthlyBook not found', customMonthlyBookId);
        return;
    }
    if (custom.status !== 'pending') {
        console.log('MonthlyBookGenerator: Skipping non-pending', customMonthlyBookId, custom.status);
        return;
    }

    await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, { status: 'generating' });

    try {
        if (custom.sourceBookId) {
            const sourceBook = await Book.findById(custom.sourceBookId).populate('featuredCharacterId').lean();
            if (!sourceBook) throw new Error('Source book not found');
            await runMonthlyBookGenerationFromBook(customMonthlyBookId, custom, sourceBook);
            return;
        }

        if (!custom.templateId) {
            throw new Error('Either templateId or sourceBookId is required');
        }
        const template = await MonthlyBookTemplate.findById(custom.templateId).populate('bibleCharacterId').lean();
        if (!template || !template.bibleCharacterId) {
            throw new Error('Template or Bible character not found');
        }
        const bibleCharacter = template.bibleCharacterId;
        const storyPages = template.storyPages || [];
        let templatePageCount = custom.hasTrialOrPaid
            ? storyPages.length
            : Math.min(4, storyPages.length);
        const testMaxEnv = process.env.MONTHLY_BOOK_MAX_PAGES_FOR_TESTING;
        if (testMaxEnv != null && testMaxEnv !== '') {
            const cap = parseInt(testMaxEnv, 10);
            if (!Number.isNaN(cap) && cap >= 1) templatePageCount = Math.min(templatePageCount, cap);
        }
        const pagesToGenerate = storyPages.slice(0, templatePageCount);

        const bookTitle = `${custom.childName}'s Adventure with ${bibleCharacter.displayName}`;
        const pages = [];
        for (let i = 0; i < pagesToGenerate.length; i++) {
            const tp = pagesToGenerate[i];
            const pageText = substituteChildName(tp.text, custom.childName);
            const backgroundUrl = await generatePageImage(custom, tp, bibleCharacter, i);
            pages.push({
                pageNumber: i + 1,
                content: {
                    text: pageText,
                    textBoxes: [
                        {
                            text: pageText,
                            x: 50,
                            y: 75,
                            width: 80,
                            alignment: 'center',
                            fontFamily: 'Patrick Hand',
                            fontSize: 22,
                            color: '#4a3b2a',
                        },
                    ],
                },
                files: {
                    background: {
                        url: backgroundUrl,
                        type: 'image',
                    },
                },
            });
        }

        const book = await Book.create({
            title: bookTitle,
            author: 'GodlyKids',
            description: `A custom story for ${custom.childName} with ${bibleCharacter.displayName}.`,
            status: 'published',
            pages,
            files: {
                coverImage: pages[0]?.files?.background?.url || PLACEHOLDER_PAGE_IMAGE,
                images: [],
                videos: [],
                audio: [],
            },
            showCharacterOverlay: false,
        });

        await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
            status: 'completed',
            bookId: book._id,
            notificationSentAt: new Date(),
        });

        const notificationTitle = '✨ Your story is ready!';
        const notificationMessage = `${custom.childName}, your adventure with ${bibleCharacter.displayName} is ready!`;
        await sendNotificationToUser({
            userId: custom.userId,
            title: notificationTitle,
            message: notificationMessage,
            url: `/book/${book._id}`,
            data: { type: 'monthly_book_ready', bookId: String(book._id), customMonthlyBookId: String(customMonthlyBookId) },
        });

        console.log('MonthlyBookGenerator: Completed', customMonthlyBookId, 'bookId', book._id);
    } catch (err) {
        console.error('MonthlyBookGenerator: Failed', customMonthlyBookId, err);
        await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
            status: 'failed',
            errorMessage: err.message || String(err),
        });
    }
}

module.exports = { runMonthlyBookGeneration };
