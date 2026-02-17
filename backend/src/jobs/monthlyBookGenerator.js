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

/** User-selected main character style (e.g. Pixar) — used so the main character stays in that style, not biblical/Jesus style. */
const MAIN_CHARACTER_STYLE_BY_ID = {
    pixar: 'Pixar 3D animated style, rounded features, playful, vibrant colors',
    disney: 'Disney 3D animated style, big sparkling eyes, magical glow, expressive',
    illustrated: "children's book watercolor illustration style, soft colors, whimsical",
    cartoon: '2D cartoon style, big expressive eyes, simplified features, bright colors',
    minecraft: 'Minecraft blocky voxel style, square features, pixelated',
    lego: 'LEGO minifigure style, yellow plastic, simple features',
};

/** Cached Google auth token for Imagen (reused across page generations) */
let _imagenToken = null;
let _imagenTokenExpiry = 0;

/** Whether we've logged the Vertex image model once (avoid spam) */
let _vertexImageModelLogged = false;

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
 * Substitute {childName}, {kidname}, {kidName}, etc. in template text.
 * Case-insensitive; supports childName and kidname (and "child name", "kid name") so portal text shows the actual name.
 */
function substituteChildName(text, childName) {
    if (!text || !childName) return text || '';
    return String(text).replace(/\{(?:childName|child name|kidname|kid name)\}/gi, childName);
}

/**
 * Recursively substitute {childName} in any string values (e.g. content.text, textBoxes[].text).
 * Ensures content.textBoxes is populated from root textBoxes (portal legacy) when content.textBoxes is missing so generated pages never lose text.
 */
function substituteChildNameInPage(pageDoc, childName) {
    const out = JSON.parse(JSON.stringify(pageDoc));
    if (!out.content) out.content = {};
    if (out.content.text) out.content.text = substituteChildName(out.content.text, childName);
    const sourceBoxes = Array.isArray(out.content.textBoxes) && out.content.textBoxes.length > 0
        ? out.content.textBoxes
        : Array.isArray(out.textBoxes) ? out.textBoxes : [];
    if (sourceBoxes.length > 0) {
        out.content.textBoxes = sourceBoxes.map((box) => ({
            ...box,
            text: substituteChildName(box.text, childName),
        }));
    }
    return out;
}

/**
 * Get Vertex AI access for Gemini (text adaptation). Returns { accessToken, projectId } or null.
 */
async function getVertexForGemini() {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) return null;
    try {
        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        if (!projectId) return null;
        const token = await getImagenAccessToken();
        if (!token) return null;
        return { accessToken: token, projectId };
    } catch (err) {
        console.warn('MonthlyBookGenerator: getVertexForGemini error', err.message);
        return null;
    }
}

/**
 * Adapt a single page text segment for 1–3 characters. For 1 name, substitutes {childName}. For 2–3, calls Gemini to rewrite so all names are included naturally.
 * @param {string} pageText - Raw template text (may contain {childName})
 * @param {string[]} characterNames - 1–3 names
 * @returns {Promise<string>} Adapted text
 */
async function adaptPageTextForCharacters(pageText, characterNames) {
    if (!pageText || typeof pageText !== 'string') return pageText || '';
    const names = Array.isArray(characterNames) ? characterNames.filter(Boolean) : [];
    if (names.length === 0) return pageText;
    if (names.length === 1) {
        return substituteChildName(pageText, names[0]);
    }
    const namesList = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    const userPrompt = `This is one page of a children's story. The following characters are in the story: ${names.join(', ')}.

Rewrite the following text so it naturally includes all of them when appropriate (e.g. "Sarah and Jake went" for two characters, or "Sarah, Jake, and Emma" for three). Keep the same tone, length, and meaning. Vary phrasing so you don't repeat "X and Y" in every sentence. Output ONLY the rewritten text, no explanation or quotes.

TEXT TO REWRITE:
"""
${pageText.slice(0, 2000)}
"""`;

    const payload = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    };

    const vertex = await getVertexForGemini();
    if (vertex) {
        const location = (process.env.VERTEX_AI_ANALYZE_SCENE_LOCATION || 'us-central1').trim();
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${vertex.projectId}/locations/${location}/publishers/google/models/gemini-2.0-flash:generateContent`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${vertex.accessToken}`,
                },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                const data = await response.json();
                const adapted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                if (adapted) return adapted;
            }
        } catch (err) {
            console.warn('MonthlyBookGenerator: adaptPageTextForCharacters Vertex error', err.message);
        }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
            );
            if (response.ok) {
                const data = await response.json();
                const adapted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                if (adapted) return adapted;
            }
        } catch (err) {
            console.warn('MonthlyBookGenerator: adaptPageTextForCharacters Gemini API error', err.message);
        }
    }

    return substituteChildName(pageText, names[0]);
}

/**
 * For image prompts only: replace language that misdirects the model (e.g. "the child", "the kid")
 * with neutral phrasing so the image model matches the reference photo instead of defaulting to a child.
 * Use "the main character" so we don't prime the AI to draw a child when the user is an adult.
 */
function neutralizeChildLanguageForImagePrompt(text) {
    if (!text || typeof text !== 'string') return text || '';
    return String(text)
        .replace(/\bthe child\b/gi, 'the main character')
        .replace(/\bthe kid\b/gi, 'the main character')
        .replace(/\ba child\b/gi, 'the main character')
        .replace(/\ba kid\b/gi, 'the main character')
        .replace(/\bthe young child\b/gi, 'the main character')
        .replace(/\bthe young kid\b/gi, 'the main character');
}

/**
 * Generate one page image for template-based flow (stub: returns placeholder).
 */
async function generatePageImage(_customBook, _templatePage, _bibleCharacter, _pageIndex) {
    return PLACEHOLDER_PAGE_IMAGE;
}

/**
 * Expand @CharacterName or @internalTag in the Image prompt (sceneDescription) to inject
 * saved character style. @kid (or @child) references the user's avatar. Used only in the prompt field;
 * text block keeps @ for voice, [] for ElevenLabs, {} for {childName}.
 * We use "the main character" (not "the child") in the image prompt so the model doesn't assume a child.
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

    // @kid / @child -> user's avatar; use child name or neutral "the main character" so image model isn't primed with "child"
    const kidTags = tags.filter((t) => t.toLowerCase() === 'kid' || t.toLowerCase() === 'child');
    if (kidTags.length > 0) {
        hasKidReference = true;
        const name = childName || 'the main character';
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
 * When sceneDescription is set, @Name is expanded for identity/description; @kid/@child flags the child's avatar for reference image.
 * When wholeBookStyleDesc is provided (user-selected style, e.g. Pixar), the entire illustration—all characters and environment—uses that style; template/saved character styles are not applied so the whole book is visually consistent.
 * When characterNames has 2+ entries, the prompt explicitly asks to include all characters in the same scene (so multiple user-added characters appear together).
 * Returns { prompt, hasKidReference }.
 */
async function buildScenePrompt(pageDoc, characterStylePrompt, childName, wholeBookStyleDesc, characterNames) {
    const names = Array.isArray(characterNames) && characterNames.length >= 2
        ? characterNames.filter(Boolean)
        : [];
    const multiCharacterInstruction = names.length >= 2
        ? ` CRITICAL: Include ALL of these characters in the SAME scene together: ${names.join(', ')}. They are the people in the reference images—show them together in this single illustration, not separately.`
        : '';

    const useWholeBookStyle = wholeBookStyleDesc && String(wholeBookStyleDesc).trim().length > 0;
    const scene = (pageDoc.sceneDescription || '').trim();
    if (scene) {
        const { text: expandedScene, stylePrompts, hasKidReference } = await expandAtReferencesInScene(
            pageDoc.sceneDescription,
            pageDoc.referenceCharacterIds,
            childName
        );
        const sceneForImage = neutralizeChildLanguageForImagePrompt(expandedScene);
        const styleBlock = useWholeBookStyle
            ? `The entire illustration—all characters and the environment—must be rendered in this style: ${String(wholeBookStyleDesc).trim()}.`
            : [characterStylePrompt, ...stylePrompts].filter(Boolean).join('. ');
        const noExtras = "Only depict what is described; do not add objects, props, or symbols (e.g. keys, crowns, scrolls) unless explicitly mentioned.";
        const prompt = `${sceneForImage}. ${styleBlock}.${multiCharacterInstruction} ${noExtras} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image.`;
        return { prompt, hasKidReference };
    }
    const text = pageDoc.content?.text || '';
    const fromBoxes = (pageDoc.content?.textBoxes || []).map((b) => b.text).filter(Boolean).join(' ');
    const combined = (text + ' ' + fromBoxes).trim().slice(0, 200);
    const context = substituteChildName(combined, childName) || 'A gentle storybook scene';
    const contextForImage = neutralizeChildLanguageForImagePrompt(context);
    const childInScene = names.length >= 2
        ? ` Include ${names.join(' and ')} in the scene together.`
        : (childName ? ` Include ${childName} in the scene.` : '');
    const stylePart = useWholeBookStyle
        ? `The entire illustration—all characters and the environment—must be rendered in this style: ${String(wholeBookStyleDesc).trim()}.`
        : characterStylePrompt;
    const noExtras = "Only depict what is described; do not add objects, props, or symbols (e.g. keys, crowns, scrolls) unless explicitly mentioned.";
    const rawPrompt = `Scene for a children's story: ${contextForImage}. ${stylePart}.${childInScene}${multiCharacterInstruction} ${noExtras} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image.`;
    const prompt = neutralizeChildLanguageForImagePrompt(rawPrompt);
    return { prompt, hasKidReference: !!childName };
}

/**
 * Gather all reference images for a page: user characters (1–3) or single child + portal characters (SavedCharacter).
 * Returns [{ base64, label }] in order: user characters first (as "character 1", "character 2", "character 3" or "the child"), then portal characters.
 */
async function gatherPageReferenceImages(customBook, pageDoc) {
    const refs = [];
    const characters = customBook.characters && customBook.characters.length > 0 ? customBook.characters.slice(0, 3) : null;
    if (characters && characters.length > 0) {
        for (let i = 0; i < characters.length; i++) {
            const c = characters[i];
            const url = c && c.characterImageUrl ? c.characterImageUrl : null;
            if (url) {
                const base64 = await fetchImageAsBase64(url);
                if (base64) {
                    refs.push({ base64, label: characters.length === 1 ? 'the child' : `character ${i + 1}` });
                } else {
                    console.warn('MonthlyBookGenerator: Failed to fetch character', i + 1, 'reference image from', url?.slice(0, 80) + '...');
                }
            }
        }
    } else if (customBook.childCharacterImageUrl) {
        const childBase64 = await fetchImageAsBase64(customBook.childCharacterImageUrl);
        if (childBase64) {
            refs.push({ base64: childBase64, label: 'the child' });
        } else {
            console.warn('MonthlyBookGenerator: Failed to fetch child reference image from', customBook.childCharacterImageUrl?.slice(0, 80) + '...');
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
 * Vertex AI image model for page generation.
 * - gemini-2.5-flash-image (default): ~$30/image output, GA, regional endpoints.
 * - gemini-3-pro-image-preview: ~$120/image output (4×), preview, higher quality; use VERTEX_AI_IMAGE_LOCATION=global.
 * Override with VERTEX_AI_IMAGE_MODEL only if you need 3 Pro and accept the higher cost.
 */
const VERTEX_IMAGE_MODEL = (process.env.VERTEX_AI_IMAGE_MODEL || 'gemini-2.5-flash-image').trim() || 'gemini-2.5-flash-image';

/**
 * Vertex AI regions that support Gemini 2.5 Flash Image (Standard PayGo & Provisioned Throughput).
 * Per model availability: Global, US (7), Europe (6). Use VERTEX_AI_IMAGE_LOCATION=global for global endpoint.
 * Round-robin across these to spread load and reduce 429s.
 */
const VERTEX_IMAGE_REGIONS_DEFAULT = [
    'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1', 'us-west1', 'us-west4',
    'europe-central2', 'europe-north1', 'europe-southwest1', 'europe-west1', 'europe-west4', 'europe-west8',
];

let _vertexRegionsLogged = false;

/**
 * Get Vertex AI endpoint for Gemini 2.5 Flash Image.
 * - VERTEX_AI_IMAGE_LOCATION=global → use global endpoint (separate quota, can reduce 429s).
 * - VERTEX_AI_IMAGE_REGIONS=us-central1,us-east1,... → round-robin across those regions only.
 * - Otherwise round-robin across VERTEX_IMAGE_REGIONS_DEFAULT (all supported regions) to maximize effective RPM.
 * @param {number} pageIndex - Used for round-robin (first attempt).
 * @param {number} [attemptOffset=0] - Added to pageIndex for retries so each retry uses a different region (avoids re-hitting same region's 429).
 * @returns {{ baseUrl: string, location: string }}
 */
function getVertexImageEndpoint(pageIndex, attemptOffset) {
    const offset = Math.max(0, parseInt(attemptOffset, 10) || 0);
    const loc = (process.env.VERTEX_AI_IMAGE_LOCATION || '').trim().toLowerCase();
    if (loc === 'global') {
        return {
            baseUrl: 'https://aiplatform.googleapis.com/v1',
            location: 'global',
        };
    }
    const regionsStr = (process.env.VERTEX_AI_IMAGE_REGIONS || '').trim();
    const regions = regionsStr
        ? regionsStr.split(/\s*,\s*/).map((r) => r.trim()).filter(Boolean)
        : VERTEX_IMAGE_REGIONS_DEFAULT;
    if (regions.length) {
        if (!_vertexRegionsLogged) {
            _vertexRegionsLogged = true;
            console.log('MonthlyBookGenerator: Using', regions.length, 'regions for Vertex Gemini image round-robin');
        }
        const idx = (Math.abs(pageIndex) + offset) % regions.length;
        const region = regions[idx];
        return {
            baseUrl: `https://${region}-aiplatform.googleapis.com/v1`,
            location: region,
        };
    }
    const region = loc || 'us-central1';
    return {
        baseUrl: `https://${region}-aiplatform.googleapis.com/v1`,
        location: region,
    };
}

/**
 * Generate one page image with Vertex Gemini 2.5 Flash Image for all pages (superior consistency).
 * Uses child + portal character reference images when available; supports text-only when no refs.
 * attemptOffset: 0 = first try, 1 = first retry (use next region), 2 = second retry (use next region).
 * Returns { imageUrl: string | null, httpStatus: number } so caller can use longer backoff on 429.
 */
async function generatePageImageWithVertexGemini(customBook, pageDoc, characterStylePrompt, pageIndex, attemptOffset, mainCharacterStyleDesc, wholeBookStyleDesc) {
    const customMonthlyBookId = String(customBook._id);
    const pageNumber = pageIndex + 1;
    const token = await getImagenAccessToken();
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let projectId = null;
    try {
        projectId = credentialsJson ? JSON.parse(credentialsJson).project_id : null;
    } catch (_) {}
    if (!token || !projectId || !bucket) return { imageUrl: null, httpStatus: 0 };
    if (!_vertexImageModelLogged) {
        _vertexImageModelLogged = true;
        console.log('MonthlyBookGenerator: Vertex image model:', VERTEX_IMAGE_MODEL);
    }

    const characterNames = (customBook.characters && customBook.characters.length > 0)
        ? customBook.characters.map((c) => (c && c.name && String(c.name).trim()) || '').filter(Boolean)
        : [customBook.childName].filter(Boolean);
    const { prompt } = await buildScenePrompt(pageDoc, characterStylePrompt, customBook.childName, wholeBookStyleDesc, characterNames);
    const referenceImages = await gatherPageReferenceImages(customBook, pageDoc);

    const firstLabel = referenceImages.length > 0 ? referenceImages[0].label : '';
    const childRefIncluded = firstLabel === 'the child' || firstLabel === 'child' || firstLabel === 'character 1';
    console.log('MonthlyBookGenerator: Page', pageNumber, 'sending', referenceImages.length, 'reference image(s); child/first ref included:', childRefIncluded);
    const hasUserCharacter = customBook.childCharacterImageUrl || (customBook.characters && customBook.characters.length > 0);
    if (hasUserCharacter && !childRefIncluded) {
        console.warn('MonthlyBookGenerator: Page', pageNumber, '— user character(s) set but reference image(s) missing (fetch may have failed); image may not match.');
    }

    // Log prompt preview for every page (including Page 1) so it's clear what prompt is used.
    const promptPreview = prompt.slice(0, 100) + (prompt.length > 100 ? '...' : '');
    const { baseUrl, location } = getVertexImageEndpoint(pageIndex, attemptOffset || 0);
    console.log('MonthlyBookGenerator: Page', pageNumber, 'prompt:', promptPreview, 'location:', location + (attemptOffset ? ` (retry ${attemptOffset})` : ''));

    // Describe reference images so the model does not assume "child" — use age-neutral wording for the main character.
    const refDescription = referenceImages.length
        ? referenceImages.map((r, i) => {
            const isFirstPerson = i === 0 && (r.label === 'the child' || r.label === 'child' || r.label === 'character 1');
            return isFirstPerson
                ? `Image ${i + 1}: the main character (match this person's exact age and appearance from the photo—only what is visible in the photo; do not add hat, cap, or headphones if not in the photo; if adult with beard depict adult, if child depict child; do not age down or change their features)`
                : `Image ${i + 1}: ${r.label} (this is a different character—draw them ONLY from this reference; do not give them the main character's hat, headphones, or modern accessories)`;
        }).join('. ')
        : '';
    const firstRefIsPerson = referenceImages.length > 0 && (referenceImages[0].label === 'the child' || referenceImages[0].label === 'child' || referenceImages[0].label === 'character 1');
    // Use user-selected main character style (e.g. Pixar) when provided; otherwise fall back to characterStylePrompt.
    const styleForMain = (mainCharacterStyleDesc && mainCharacterStyleDesc.trim()) || (characterStylePrompt && characterStylePrompt.trim());
    const styleLock = styleForMain
        ? ` The main character (reference Image 1) MUST be drawn in this exact art style: "${styleForMain.trim()}". Do NOT draw the main character in a classical religious, biblical, or traditional Jesus painting style. Keep the main character in the selected style (e.g. Pixar 3D, Disney, illustrated) on every page—do not shift their look toward other characters' style. `
        : ` Do NOT draw the main character in a classical religious or biblical painting style; keep them in the selected storybook/animation style (e.g. Pixar, Disney, illustrated) on every page. `;
    const heightConsistency = ` The main character must appear at the SAME height and scale on every page. If the reference photo shows an ADULT, the main character must be drawn at ADULT height (clearly taller than any children in the scene). If the reference shows a child, use child height. Do not make the main character taller, shorter, or a different size from page to page—keep their scale consistent across all scenes. `;
    // When multiple user characters (2–3 refs): keep realistic relative heights—adult taller than child, two adults similar height; no giant/tiny disproportion
    const multiCharacterHeight = referenceImages.length >= 2
        ? ` Draw all characters from the reference images at realistic, consistent relative heights. If one reference shows an adult and another a child, the adult must be clearly taller. If both (or all) are adults, draw them at similar height—do not make one character disproportionately large (giant) or small (tiny). Keep natural human proportions and scale between characters. `
        : '';
    const personConsistencyInstruction = firstRefIsPerson
        ? ` CRITICAL — character consistency: The person in reference Image 1 must look EXACTLY like the photo in every image: same face, same AGE (if adult with beard = draw adult with beard; do NOT turn them into a child), same eye color (e.g. brown eyes stay brown), same hair (including streaks or gray), same clothing, and only the accessories that appear in the reference (if the photo has no hat and no headphones, draw them with no hat and no headphones—do NOT add hats, caps, or headphones unless visible in the reference). Do NOT age them down, change eye color, remove beard, or replace their real outfit with costumes. If the reference is an adult, draw them at adult height (taller than children). Preserve identical appearance on every page.${styleLock}${heightConsistency} `
        : '';
    // When multiple reference images: they are DIFFERENT people — do not blend or mix; do not put main character's accessories on biblical characters.
    const multiPersonInstruction = referenceImages.length >= 2
        ? ` CRITICAL — these reference images are DIFFERENT people. Do NOT blend, combine, or mix their faces or appearances. Image 1 = the main character (the kid/user): use ONLY Image 1 for that person's face, body, clothing, and accessories. Image 2 and any later images = other characters (e.g. Jesus, biblical figures): use ONLY their own reference image for each. Do NOT put the main character's clothing or accessories (e.g. hat, cap, headphones, modern clothes) on Jesus or any other character. Biblical and story characters must keep their own traditional appearance from their reference; only the person from Image 1 may have modern accessories if they appear in Image 1. Do not transfer features (beard, hair, skin, clothing, accessories) from one reference to another.${multiCharacterHeight} `
        : '';
    const geminiPrompt = referenceImages.length
        ? `${personConsistencyInstruction}${multiPersonInstruction}Using the provided reference images (${refDescription}), generate one image: ${prompt} Remember: Image 1 (main character) only—same age, eye color, hair, clothing and accessories as in their photo (no hat/headphones unless in photo). Other characters (Image 2+) must look only like their own reference—never give them the main character's hat, headphones, or modern clothes. Place each character in the scene as described. Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image. Vertical 9:16 composition.`
        : `Generate one image: ${prompt} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, Christian faith theme, no text in image. Vertical 9:16 composition.`;

    const parts = [{ text: geminiPrompt }];
    for (const ref of referenceImages) {
        parts.push({ inlineData: { mimeType: 'image/png', data: ref.base64 } });
    }

    try {
        const url = `${baseUrl}/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_IMAGE_MODEL}:generateContent`;
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
            console.warn('MonthlyBookGenerator: Gemini page', pageNumber, 'failed', res.status, res.status === 429 ? '(rate limit)' : '', typeof res.data === 'string' ? res.data.slice(0, 150) : '');
            return { imageUrl: null, httpStatus: res.status };
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
            return { imageUrl: null, httpStatus: 200 };
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
        return { imageUrl, httpStatus: 200 };
    } catch (err) {
        const status = err.response?.status;
        console.warn('MonthlyBookGenerator: Gemini page', pageNumber, 'error', err.message, status ? `(${status})` : '');
        return { imageUrl: null, httpStatus: status || 0 };
    }
}

/**
 * Number of Gemini attempts per page before failing (no Imagen fallback).
 * Vertex charges only for successful image generation; 429 (rate limit) responses are not billed.
 * So more attempts don't increase cost when they fail—they just give more chances across regions.
 * Override with MONTHLY_BOOK_GEMINI_MAX_ATTEMPTS (e.g. 20 to try many regions before giving up).
 */
const PAGE_GEMINI_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.MONTHLY_BOOK_GEMINI_MAX_ATTEMPTS, 10) || 20);

/**
 * Randomized exponential backoff for Vertex AI 429 / transient errors (per Google Cloud recommendation).
 * delay = min(baseMs * 2^attempt + jitter, maxMs). Jitter spreads retries so we don't thundering-herd.
 * @param {number} attempt - 1-based attempt number (1 = first retry).
 * @param {boolean} is429 - true if last response was 429 RESOURCE_EXHAUSTED (use longer base/max).
 * @returns {number} Delay in milliseconds.
 */
function vertexBackoffMs(attempt, is429) {
    const baseMs = is429 ? 5000 : 2000;
    const maxMs = is429 ? 120000 : 30000;
    const exponential = baseMs * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * (baseMs + 1));
    return Math.min(exponential + jitter, maxMs);
}

/**
 * Gemini 2.5 Flash Image uses Standard PayGo (shared capacity). Use exponential backoff on 429
 * and smooth request rate (delay between pages). See:
 * https://cloud.google.com/vertex-ai/generative-ai/docs/standard-paygo
 * https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/error-code-429
 */
/** Delay in ms between generating one page and the next (smooth request rate). Override with MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS. */
const DELAY_BETWEEN_PAGES_MS = parseInt(process.env.MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS, 10) || 5000;

/**
 * Generate one page background image for Book-based flow. Gemini 2.5 Flash only; retries up to PAGE_GEMINI_MAX_ATTEMPTS.
 * No Imagen fallback. Uses page.sceneDescription or page text + character style; uploads to GCS and returns URL.
 * mainCharacterStyleDesc: style for the main character (kid) only.
 * wholeBookStyleDesc: style for the entire book (all characters + environment); can differ from main character.
 * Throws if all Gemini attempts fail or credentials/GCS missing.
 */
async function generatePageImageForBook(customBook, pageDoc, characterStylePrompt, pageIndex, mainCharacterStyleDesc, wholeBookStyleDesc) {
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

    let lastHttpStatus = 0;
    for (let attempt = 1; attempt <= PAGE_GEMINI_MAX_ATTEMPTS; attempt++) {
        const attemptOffset = attempt - 1; // 0 = first try, 1 = first retry (different region), etc.
        const { imageUrl: geminiUrl, httpStatus } = await generatePageImageWithVertexGemini(customBook, pageDoc, characterStylePrompt, pageIndex, attemptOffset, mainCharacterStyleDesc, wholeBookStyleDesc);
        if (geminiUrl) return geminiUrl;
        lastHttpStatus = httpStatus;
        if (attempt < PAGE_GEMINI_MAX_ATTEMPTS) {
            const delayMs = vertexBackoffMs(attempt, httpStatus === 429);
            console.log('MonthlyBookGenerator: Gemini page', pageNumber, 'attempt', attempt, 'failed' + (httpStatus === 429 ? ' (429 rate limit)' : '') + '; exponential backoff: retrying in', delayMs, 'ms (different region)...');
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error('Page ' + pageNumber + ': Gemini 2.5 Flash Image failed after ' + PAGE_GEMINI_MAX_ATTEMPTS + ' attempts (last status ' + lastHttpStatus + '). Use exponential backoff; consider MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS or Provisioned Throughput.');
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
                subjectDescription: `The person in this photo (${childName}). Match their exact age and appearance: if they are an adult (e.g. with beard), depict an adult; if a child, depict a child. Depict only the clothing and accessories visible in the photo—do not add hat or headphones unless they appear in the photo. Do not age them down. Include them in the scene with ${characterName}.`,
                subjectType: 'SUBJECT_TYPE_PERSON',
            },
        });
    }

    const prompt = templateCoverBase64
        ? `Recreate this book cover in the same style and composition. Feature the person [${subjectRefId || 1}] and ${characterName} (${characterStyle}). Depict the person exactly as in the reference photo—same age (adult or child), same features and clothing; do not add hat or headphones unless they appear in the reference; do not age them down. Children's book illustration, Christian faith theme, ages 4-12, no text in image.`
        : subjectRefId
            ? `Children's book cover: The person [${subjectRefId}] and ${characterName} (${characterStyle}) standing together in a warm, magical storybook scene. Depict the person exactly as in the reference—same age and appearance; only show accessories (e.g. hat, headphones) if they appear in the reference photo. Both characters visible and friendly, side by side. Children's book illustration style, Christian faith theme, suitable for ages 4-12, no text in image.`
            : `Children's book cover: ${childName} and ${characterName} (${characterStyle}) standing together in a warm, magical storybook scene. Both characters visible and friendly, side by side. Children's book illustration style, Christian faith theme, suitable for ages 4-12, no text in image.`;

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
    // Main character (kid) style — how the kid is drawn (e.g. Lego); from character creation or book flow.
    const charStyleId = (custom.characterStyleId || 'illustrated').toLowerCase();
    const mainCharacterStyleDesc = MAIN_CHARACTER_STYLE_BY_ID[charStyleId] || characterStylePrompt;
    // Whole-book style — how the entire book (all characters + environment) is drawn (e.g. Pixar); can differ from main character.
    const bookStyleId = (custom.bookStyleId || custom.characterStyleId || 'illustrated').toLowerCase();
    const wholeBookStyleDesc = MAIN_CHARACTER_STYLE_BY_ID[bookStyleId] || characterStylePrompt;

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

    const characterNames = (custom.characters && custom.characters.length > 0)
        ? custom.characters.map((c) => (c && c.name && String(c.name).trim()) || '').filter(Boolean)
        : [custom.childName].filter(Boolean);
    const multiCharacter = characterNames.length > 1;

    const isResume = custom.bookId && (custom.progressPage || 0) >= 1 && (custom.progressTotalPages || 0) > 0;
    let startIndex = 0;
    let book = null;
    let bookTitle;
    let coverUrl;

    if (isResume) {
        book = await Book.findById(custom.bookId).lean();
        if (!book) {
            console.warn('MonthlyBookGenerator: Resume requested but Book not found', custom.bookId, '- starting from scratch');
        } else {
            startIndex = Math.min(custom.progressPage || 0, pagesToProcess.length);
            bookTitle = book.title;
            coverUrl = book.files?.coverImage || book.coverImage;
            console.log('MonthlyBookGenerator: Resuming from page', startIndex + 1, 'of', pagesToProcess.length, 'existing Book', custom.bookId);
        }
    }

    if (!isResume || !book) {
        await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
            progressTotalPages: pageCount,
            progressPage: 0,
        });
        bookTitle = substituteChildName(sourceBook.title, custom.childName) || `${custom.childName}'s ${sourceBook.title}`;
        const sourceCoverUrl = sourceBook.files?.coverImage || sourceBook.coverImage;
        coverUrl = sourceCoverUrl ? sourceCoverUrl : await generateCoverImageForBook(custom, sourceBook);
    }

    const bookIdShort = String(customMonthlyBookId).slice(-8);

    const toPageDoc = (p, bid) => {
        const content = p.content || {};
        const textBoxes = (content.textBoxes && content.textBoxes.length > 0) ? content.textBoxes : (p.textBoxes || []);
        return {
            bookId: bid,
            pageNumber: p.pageNumber,
            content: { ...content, textBoxes },
            files: p.files || {},
            scrollUrl: p.scrollUrl || p.files?.scroll?.url || undefined,
            isColoringPage: p.isColoringPage || false,
            coloringEndModalOnly: p.coloringEndModalOnly !== false,
            isWebViewPage: p.isWebViewPage || false,
            webView: p.webView || {},
            backgroundImageAnimation: p.backgroundImageAnimation ?? 'kenBurns',
            backgroundImageAnimationDuration: p.backgroundImageAnimationDuration ?? 10,
            textBoxes, // root-level so reader fallback (page.textBoxes) works
        };
    };

    for (let i = startIndex; i < pagesToProcess.length; i++) {
        const pageNum = i + 1;
        const total = pagesToProcess.length;
        console.log(`MonthlyBookGenerator: [${bookIdShort}] Starting page ${pageNum}/${total} (loop index ${i})`);
        if (i > 0) {
            console.log('MonthlyBookGenerator: Waiting', DELAY_BETWEEN_PAGES_MS, 'ms before page', pageNum, '(rate limit avoidance)');
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAGES_MS));
        }
        const pageDoc = pagesToProcess[i];
        const hasText = (pageDoc.content?.textBoxes?.length > 0) || (pageDoc.content?.text && String(pageDoc.content.text).trim().length > 0);
        if (!hasText) {
            console.warn(`MonthlyBookGenerator: [${bookIdShort}] Page ${pageNum}/${total} has no text content (no textBoxes and no content.text). Check source book in portal.`);
        }
        const portalPrompt = (pageDoc.sceneDescription || '').trim();
        const hasPortalPrompt = portalPrompt.length > 0;
        const preview = hasPortalPrompt ? ` "${portalPrompt.slice(0, 80)}${portalPrompt.length > 80 ? '...' : ''}"` : '';
        console.log(`MonthlyBookGenerator: Page ${pageNum}/${total} ${hasPortalPrompt ? 'using portal scene prompt' : 'using fallback from page text'}${preview}`);

        let pageWithName;
        if (multiCharacter && characterNames.length > 1) {
            const out = JSON.parse(JSON.stringify(pageDoc));
            if (!out.content) out.content = {};
            const sourceBoxes = Array.isArray(out.content.textBoxes) && out.content.textBoxes.length > 0
                ? out.content.textBoxes
                : Array.isArray(out.textBoxes) ? out.textBoxes : [];
            if (out.content.text) {
                out.content.text = await adaptPageTextForCharacters(out.content.text, characterNames);
            }
            if (sourceBoxes.length > 0) {
                out.content.textBoxes = await Promise.all(
                    sourceBoxes.map(async (box) => ({
                        ...box,
                        text: await adaptPageTextForCharacters(box.text || '', characterNames),
                    }))
                );
            }
            pageWithName = out;
        } else {
            pageWithName = substituteChildNameInPage(pageDoc, characterNames[0] || custom.childName);
        }

        const backgroundUrl = await generatePageImageForBook(
            custom,
            pageDoc,
            characterStylePrompt,
            i,
            mainCharacterStyleDesc,
            wholeBookStyleDesc
        );
        // Preserve source page content and files (including scroll) so text and scroll UI are present in the reader
        const pagePayload = {
            pageNumber: pageNum,
            content: pageWithName.content || {},
            files: {
                ...(pageWithName.files || {}),
                background: {
                    url: backgroundUrl,
                    type: pageWithName.files?.background?.type || 'image',
                },
            },
        };
        // Copy scroll from source so reader shows parchment + text (reader checks page.scrollUrl and page.files.scroll.url)
        const sourceScrollUrl = pageWithName.files?.scroll?.url || pageWithName.scrollUrl;
        if (sourceScrollUrl) {
            pagePayload.scrollUrl = sourceScrollUrl;
            pagePayload.files = pagePayload.files || {};
            pagePayload.files.scroll = { url: sourceScrollUrl };
        }
        if (pageWithName.isColoringPage != null) pagePayload.isColoringPage = pageWithName.isColoringPage;
        if (pageWithName.coloringEndModalOnly != null) pagePayload.coloringEndModalOnly = pageWithName.coloringEndModalOnly;
        if (pageWithName.isWebViewPage != null) pagePayload.isWebViewPage = pageWithName.isWebViewPage;
        if (pageWithName.webView) pagePayload.webView = pageWithName.webView;
        if (pageWithName.backgroundImageAnimation != null) pagePayload.backgroundImageAnimation = pageWithName.backgroundImageAnimation;
        if (pageWithName.backgroundImageAnimationDuration != null) pagePayload.backgroundImageAnimationDuration = pageWithName.backgroundImageAnimationDuration;

        if (!book) {
            // Create book and first page so user can open and test (text, TTS, etc.) while the rest generate
            const narratorVoiceId = custom.narratorVoiceId
                || sourceBook.defaultNarratorVoiceId
                || sourceBook.files?.defaultNarratorVoiceId
                || sourceBook.defaultVoiceId
                || sourceBook.files?.defaultVoiceId
                || null;
            // Copy background music from template so generated book has same audio; reader uses files.audio[defaultAudioIndex].url
            const sourceAudio = Array.isArray(sourceBook.files?.audio) ? sourceBook.files.audio : [];
            const audioTracks = sourceAudio
                .filter((t) => t && t.url)
                .map((t) => ({ url: t.url, filename: t.filename || null, uploadedAt: t.uploadedAt || new Date() }));
            const musicIdx = Math.max(0, Math.min((custom.backgroundMusicIndex ?? sourceBook.files?.defaultAudioIndex ?? 0), Math.max(0, audioTracks.length - 1)));
            const defaultAudioIndex = audioTracks.length > 0 ? musicIdx : 0;
            if (sourceAudio.length > 0 && audioTracks.length === 0) {
                console.warn('MonthlyBookGenerator: Template book has files.audio but no valid URLs; background music will be missing.');
            } else if (audioTracks.length > 0) {
                console.log(`MonthlyBookGenerator: [${bookIdShort}] Copying ${audioTracks.length} background music track(s), default index ${defaultAudioIndex}`);
            }
            book = await Book.create({
                title: bookTitle,
                author: sourceBook.author || 'GodlyKids',
                description: substituteChildName(sourceBook.description || `A custom story for ${custom.childName}.`, custom.childName),
                status: 'published',
                bookType: 'standard',
                pages: [pagePayload],
                files: {
                    coverImage: coverUrl,
                    images: [],
                    videos: [],
                    audio: audioTracks,
                    defaultAudioIndex,
                },
                // Create Your Story: characters are already in the generated image; do not overlay a second character/photo
                showCharacterOverlay: false,
                defaultVoiceId: narratorVoiceId,
                defaultNarratorVoiceId: narratorVoiceId,
            });
            await Page.create(toPageDoc(pagePayload, book._id));
            await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, { bookId: book._id, progressPage: pageNum });
            console.log(`MonthlyBookGenerator: [${bookIdShort}] Book created; preview at /book/${book._id} (${pageNum} page). More pages will appear as they generate.`);
        } else {
            await Book.findByIdAndUpdate(book._id, { $push: { pages: pagePayload } });
            await Page.create(toPageDoc(pagePayload, book._id));
            await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, { progressPage: pageNum });
        }
        console.log(`MonthlyBookGenerator: [${bookIdShort}] Finished page ${pageNum}/${total}`);
    }

    await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
        status: 'completed',
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
    let custom = await CustomMonthlyBook.findById(customMonthlyBookId)
        .populate('templateId')
        .lean();
    if (!custom) {
        console.error('MonthlyBookGenerator: CustomMonthlyBook not found', customMonthlyBookId);
        return;
    }
    const isResume = custom.status === 'generating' && custom.bookId && custom.progressPage >= 1 && (custom.progressTotalPages || 0) > custom.progressPage;
    if (custom.status === 'completed' || custom.status === 'failed') {
        console.log('MonthlyBookGenerator: Skipping completed/failed', customMonthlyBookId, custom.status);
        return;
    }
    if (custom.status === 'pending' || isResume) {
        if (custom.status === 'pending') {
            // Claim the job so only one worker processes this book (avoid concurrent runs skipping/duplicating pages)
            const updated = await CustomMonthlyBook.findOneAndUpdate(
                { _id: customMonthlyBookId, status: 'pending' },
                { $set: { status: 'generating' } },
                { new: true }
            );
            if (!updated) {
                console.log('MonthlyBookGenerator: Book already claimed or not pending', customMonthlyBookId);
                return;
            }
            custom = updated;
        } else {
            // Resuming: re-fetch to get latest progressPage
            custom = await CustomMonthlyBook.findById(customMonthlyBookId).populate('templateId').lean();
            console.log('MonthlyBookGenerator: Resuming', customMonthlyBookId, 'from page', custom.progressPage + 1, 'of', custom.progressTotalPages);
        }
    } else {
        console.log('MonthlyBookGenerator: Skipping', customMonthlyBookId, custom.status);
        return;
    }

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
