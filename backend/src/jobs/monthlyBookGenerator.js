const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const MonthlyBookTemplate = require('../models/MonthlyBookTemplate');
const SavedCharacter = require('../models/SavedCharacter');
const Book = require('../models/Book');
const Page = require('../models/Page');
const { sendNotificationToUser } = require('../services/notificationService');
const { bucket } = require('../config/storage');

/** OpenAI GPT Image model for Bible Map (and other portal) page art. Override with OPENAI_IMAGE_MODEL. */
const OPENAI_IMAGE_MODEL =
    (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2').trim() || 'gpt-image-2';
/** Portrait size closest to 9:16 for storybook pages (Kids Monthly, etc.). */
const OPENAI_IMAGE_SIZE = (process.env.OPENAI_IMAGE_SIZE || '1024x1536').trim() || '1024x1536';
/**
 * OpenAI size for Bible Map 3:4 pages. gpt-image supports 1024x1536 as portrait;
 * prompt + Gemini use exact 3:4. Override with OPENAI_IMAGE_SIZE_BIBLE_MAP.
 */
const OPENAI_IMAGE_SIZE_BIBLE_MAP =
    (process.env.OPENAI_IMAGE_SIZE_BIBLE_MAP || OPENAI_IMAGE_SIZE).trim() || OPENAI_IMAGE_SIZE;

/** Bible Map page art sits above parchment/scroll (iPad-style 3:4), not full-bleed 9:16. */
const BIBLE_MAP_ASPECT_RATIO = '3:4';

function openaiSizeForAspectRatio(aspectRatio) {
    const ar = String(aspectRatio || '9:16').trim();
    if (ar === '3:4') return OPENAI_IMAGE_SIZE_BIBLE_MAP;
    if (ar === '1:1') return '1024x1024';
    return OPENAI_IMAGE_SIZE;
}

function compositionHintForAspectRatio(aspectRatio) {
    const ar = String(aspectRatio || '9:16').trim();
    if (ar === '3:4') return 'iPad-style 3:4 portrait composition';
    if (ar === '1:1') return 'Square 1:1 composition';
    return 'Vertical 9:16 composition';
}

const PLACEHOLDER_PAGE_IMAGE = 'https://picsum.photos/seed/story/800/600';

/** User-selected main character style (e.g. Pixar) — used so the main character stays in that style, not biblical/Jesus style. */
const MAIN_CHARACTER_STYLE_BY_ID = {
    pixar: 'Pixar 3D animated style, rounded features, playful, vibrant colors',
    disney: 'Disney 2D animated style, flat or cel-shaded, not 3D—classic hand-drawn animation look, big expressive eyes, distinct from Pixar 3D',
    illustrated: "children's book watercolor illustration style, soft colors, whimsical",
    cartoon: '2D cartoon style, big expressive eyes, simplified features, bright colors',
    minecraft: 'Minecraft blocky voxel style, square features, pixelated',
    lego: 'LEGO minifigure style, yellow plastic, simple features',
    anime: 'Disney 2D animated style, flat or cel-shaded, not 3D—classic hand-drawn animation look, big expressive eyes, distinct from Pixar 3D', // backward compat
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
    const userPrompt = `This is one page of a children's Bible story. The kids in the story are: ${namesList}.

The text below uses {childName} as a placeholder for the kids' names. Replace every {childName} placeholder with the kids' names (${namesList}), naturally varying which kid is mentioned. For two kids, alternate or group them (e.g. "${names[0]} and ${names[1]} walked together"). For three, vary who is mentioned each sentence.

CRITICAL: Do NOT change any other names that already appear in the text. Biblical and story character names (like David, Goliath, Moses, Jesus, Mary, Joseph, Daniel, Jonah, Noah, Esther, Ruth, Abraham, etc.) must remain EXACTLY as written. Only replace {childName} placeholders — never swap a biblical character's name with a kid's name.

Keep the same tone, length, and meaning. Output ONLY the rewritten text, no explanation or quotes.

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
        const noExtras = "Only depict what is described; do not add objects, props, or symbols (e.g. keys, crowns, scrolls) unless explicitly mentioned. Do not add biblical characters (e.g. Jesus, prophets, angels) unless explicitly named in the scene description.";
        const prompt = `${sceneForImage}. ${styleBlock}.${multiCharacterInstruction} ${noExtras} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, no text in image.`;
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
    const noExtras = "Only depict what is described; do not add objects, props, or symbols (e.g. keys, crowns, scrolls) unless explicitly mentioned. Do not add biblical characters (e.g. Jesus, prophets, angels) unless explicitly named in the scene description.";
    const rawPrompt = `Scene for a children's story: ${contextForImage}. ${stylePart}.${childInScene}${multiCharacterInstruction} ${noExtras} Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, no text in image.`;
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
 * - gemini-3.1-flash-image (default): GA, global endpoint only (Vertex locations docs).
 * - gemini-2.5-flash-image: GA, regional + global; used automatically if 3.1 returns 404.
 * - gemini-3-pro-image: higher quality; global endpoint only.
 * Override with VERTEX_AI_IMAGE_MODEL.
 */
const VERTEX_IMAGE_MODEL = (process.env.VERTEX_AI_IMAGE_MODEL || 'gemini-3.1-flash-image').trim() || 'gemini-3.1-flash-image';
const VERTEX_IMAGE_FALLBACK_MODEL = 'gemini-2.5-flash-image';

/** Models that Vertex only serves on the global endpoint (regional URLs return 404). */
const VERTEX_IMAGE_GLOBAL_ONLY_MODELS = new Set([
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
]);

/**
 * Vertex AI regions that support gemini-2.5-flash-image (Standard PayGo & Provisioned Throughput).
 * Per model availability: Global, US (7), Europe (6). Use VERTEX_AI_IMAGE_LOCATION=global for global endpoint.
 * Round-robin across these to spread load and reduce 429s.
 */
const VERTEX_IMAGE_REGIONS_DEFAULT = [
    'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1', 'us-west1', 'us-west4',
    'europe-central2', 'europe-north1', 'europe-southwest1', 'europe-west1', 'europe-west4', 'europe-west8',
];

let _vertexRegionsLogged = false;

/**
 * Get Vertex AI endpoint for the configured Gemini image model.
 * - Global-only models (3.1 flash image, 3 pro image) always use the global endpoint.
 * - VERTEX_AI_IMAGE_LOCATION=global → use global endpoint.
 * - VERTEX_AI_IMAGE_REGIONS=us-central1,us-east1,... → round-robin across those regions only.
 * - Otherwise round-robin across VERTEX_IMAGE_REGIONS_DEFAULT (all supported regions) to maximize effective RPM.
 * @param {number} pageIndex - Used for round-robin (first attempt).
 * @param {number} [attemptOffset=0] - Added to pageIndex for retries so each retry uses a different region (avoids re-hitting same region's 429).
 * @param {string} [model] - Model id (defaults to VERTEX_IMAGE_MODEL).
 * @returns {{ baseUrl: string, location: string }}
 */
function getVertexImageEndpoint(pageIndex, attemptOffset, model) {
    const modelId = (model || VERTEX_IMAGE_MODEL || '').trim();
    const offset = Math.max(0, parseInt(attemptOffset, 10) || 0);
    const loc = (process.env.VERTEX_AI_IMAGE_LOCATION || '').trim().toLowerCase();
    if (loc === 'global' || VERTEX_IMAGE_GLOBAL_ONLY_MODELS.has(modelId)) {
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
 * Generate one page image with the Vertex Gemini flash image model for all pages (superior consistency).
 * Uses child + portal character reference images when available; supports text-only when no refs.
 * attemptOffset: 0 = first try, 1 = first retry (use next region), 2 = second retry (use next region).
 * modelOverride: optional model id (e.g. fallback to gemini-2.5-flash-image after 404 on 3.1).
 * Returns { imageUrl: string | null, httpStatus: number } so caller can use longer backoff on 429.
 */
async function generatePageImageWithVertexGemini(customBook, pageDoc, characterStylePrompt, pageIndex, attemptOffset, mainCharacterStyleDesc, wholeBookStyleDesc, modelOverride, aspectRatio = '9:16') {
    const customMonthlyBookId = String(customBook._id);
    const pageNumber = pageIndex + 1;
    const imageModel = (modelOverride || VERTEX_IMAGE_MODEL).trim() || VERTEX_IMAGE_MODEL;
    const token = await getImagenAccessToken();
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let projectId = null;
    try {
        projectId = credentialsJson ? JSON.parse(credentialsJson).project_id : null;
    } catch (_) {}
    if (!token || !projectId || !bucket) return { imageUrl: null, httpStatus: 0 };
    if (!_vertexImageModelLogged) {
        _vertexImageModelLogged = true;
        console.log('MonthlyBookGenerator: Vertex image model:', imageModel,
            VERTEX_IMAGE_GLOBAL_ONLY_MODELS.has(imageModel) ? '(global endpoint only)' : '');
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
    const { baseUrl, location } = getVertexImageEndpoint(pageIndex, attemptOffset || 0, imageModel);
    console.log('MonthlyBookGenerator: Page', pageNumber, 'prompt:', promptPreview, 'model:', imageModel, 'location:', location + (attemptOffset ? ` (retry ${attemptOffset})` : ''));

    // When 2–3 refs are all user characters (kids), each must keep ONLY their own appearance—no swapping accessories.
    const isUserRef = (label) => /^(the child|child|character 1|character 2|character 3)$/i.test(String(label || '').trim());
    const allRefsAreUserCharacters = referenceImages.length >= 2 && referenceImages.every((r) => isUserRef(r.label));
    if (allRefsAreUserCharacters) {
        console.log('MonthlyBookGenerator: Page', pageNumber, '— multiple user characters detected; enforcing per-person accessories (no hat/headphones swap).');
    }

    // Describe reference images so the model does not assume "child" — use age-neutral wording for the main character.
    const refDescription = referenceImages.length
        ? referenceImages.map((r, i) => {
            const imgNum = i + 1;
            if (allRefsAreUserCharacters) {
                return `Image ${imgNum}: ${r.label} — match this person ONLY from this reference photo. Draw only the face, hair, clothing, and accessories that are visible in THIS image. Do not add hat, cap, headphones, or glasses unless they appear in this photo. Do NOT give this person any accessory (hat, headphones, glasses, etc.) that appears on a different reference image—each person keeps only what is in their own photo.`;
            }
            const isFirstPerson = i === 0 && (r.label === 'the child' || r.label === 'child' || r.label === 'character 1');
            return isFirstPerson
                ? `Image ${imgNum}: the main character (match this person's exact age and appearance from the photo—only what is visible in the photo; do not add hat, cap, or headphones if not in the photo; if adult with beard depict adult, if child depict child; do not age down or change their features)`
                : `Image ${imgNum}: ${r.label} (this is a different character—draw them ONLY from this reference; do NOT give them the main character's hat, headphones, tattoo, watch, or any modern accessory; biblical characters have their own traditional appearance)`;
        }).join('. ')
        : '';
    const firstRefIsPerson = referenceImages.length > 0 && (referenceImages[0].label === 'the child' || referenceImages[0].label === 'child' || referenceImages[0].label === 'character 1');
    // When user selected a book style (e.g. Pixar), enforce it for the ENTIRE image so we don't get cartoon/Disney 2D instead.
    const hasWholeBookStyle = wholeBookStyleDesc && String(wholeBookStyleDesc).trim().length > 0;
    const wholeImageStyleLock = hasWholeBookStyle
        ? ` CRITICAL — Style: The ENTIRE image (all characters, background, and environment) MUST be rendered in this exact style: "${String(wholeBookStyleDesc).trim()}". Do NOT use a flat 2D cartoon style, 2D Disney animation style, or storybook watercolor illustration style. Use the selected style (e.g. Pixar 3D animated, with rounded volumes and 3D lighting) for the whole scene—consistent from page to page. `
        : '';
    const compositionHint = compositionHintForAspectRatio(aspectRatio);
    const styleClosing = hasWholeBookStyle
        ? `Render the entire image in the selected style above. Warm inviting colors, soft lighting, suitable for ages 4-12, no text in image. ${compositionHint}. Do not add biblical characters (e.g. Jesus, prophets, angels) unless explicitly named in the prompt.`
        : `Children's book illustration style, warm inviting colors, soft lighting, suitable for ages 4-12, no text in image. ${compositionHint}. Do not add biblical characters (e.g. Jesus, prophets, angels) unless explicitly named in the prompt.`;
    // Use user-selected main character style (e.g. Pixar) when provided; otherwise fall back to characterStylePrompt.
    const styleForMain = (mainCharacterStyleDesc && mainCharacterStyleDesc.trim()) || (characterStylePrompt && characterStylePrompt.trim());
    const styleLock = styleForMain
        ? ` The main character (reference Image 1) MUST be drawn in this exact art style: "${styleForMain.trim()}". Do NOT draw the main character in a classical religious, biblical, or traditional Jesus painting style. Keep the main character in the selected style (e.g. Pixar 3D, Disney, illustrated) on every page—do not shift their look toward other characters' style. `
        : ` Do NOT draw the main character in a classical religious or biblical painting style; keep them in the selected storybook/animation style (e.g. Pixar, Disney, illustrated) on every page. `;
    const heightConsistency = ` The main character must appear at the SAME height and scale on every page. If the reference photo shows an ADULT, the main character must be drawn at ADULT height (clearly taller than any children in the scene). If the reference shows a child, use child height. Do not make the main character taller, shorter, or a different size from page to page—keep their scale consistent across all scenes. `;
    // MANDATORY height rule: adults must be same scale—never draw one adult as giant and another as tiny (fixes Jesus/main-character disproportion)
    const mandatoryHeightRule = referenceImages.length >= 2
        ? ` CRITICAL — HEIGHT AND SCALE: When the main character (Image 1) is an ADULT and another reference (e.g. Jesus, Joseph) is also an ADULT, BOTH must be drawn at the SAME adult scale. They must be roughly the same height—within normal human variation (e.g. a few inches). NEVER draw Jesus or biblical figures shorter, smaller, or child-sized when the main character is an adult. NEVER draw one adult twice the height of another. If the main character is a child and Jesus is an adult, Jesus must be clearly taller (adult vs child). If both are adults, they MUST appear as two adults of similar size standing together. Do not put Jesus on a stool or elevated surface to compensate—draw him at full adult height. `
        : '';
    // When multiple user characters (2–3 refs): keep realistic relative heights—adult taller than child, two adults similar height; no giant/tiny disproportion
    const multiCharacterHeight = referenceImages.length >= 2
        ? ` Draw all characters from the reference images at realistic, consistent relative heights. If one reference shows an adult and another a child, the adult must be clearly taller. If both (or all) are adults, draw them at similar height—do not make one character disproportionately large (giant) or small (tiny). Keep natural human proportions and scale between characters. `
        : '';
    const personConsistencyInstruction = firstRefIsPerson
        ? ` CRITICAL — character consistency: The person in reference Image 1 must look EXACTLY like the photo in every image: same face, same AGE (if adult with beard = draw adult with beard; do NOT turn them into a child), same eye color (e.g. brown eyes stay brown), same hair (including streaks or gray), same clothing, and only the accessories that appear in the reference (if the photo has no hat and no headphones, draw them with no hat and no headphones—do NOT add hats, caps, or headphones unless visible in the reference). Do NOT age them down, change eye color, remove beard, or replace their real outfit with costumes. If the reference is an adult, draw them at adult height (taller than children). Preserve identical appearance on every page.${styleLock}${heightConsistency} `
        : '';
    // When multiple user characters: require ALL to appear on every page; never omit one.
    const numUserRefs = referenceImages.length;
    const allMustAppearInstruction = allRefsAreUserCharacters && numUserRefs >= 2
        ? ` MANDATORY: You MUST include every person from the ${numUserRefs} reference images in this scene. All ${numUserRefs} people must be visible in the illustration—do not omit any character. If there are 2 reference images, show 2 people; if 3, show 3 people. Every reference image corresponds to one person who must appear. `
        : '';
    // Anti-artifacts for multi-user: no Jesus-like look, keep hat if in reference, no holding extra shoes, height from reference.
    const multiUserAntiArtifacts = allRefsAreUserCharacters && numUserRefs >= 2
        ? ` Do NOT draw any of these people in a classical religious, biblical, or Jesus-like style (no long wavy hair, serene beard, or saintly look). Each person must look like a normal modern person matching their reference photo—same face, hair style, and clothing. If a reference photo shows someone wearing a cap or hat, that person MUST be drawn wearing the cap/hat in the scene; do not omit it. Do NOT draw anyone holding or carrying an extra pair of shoes, sneakers, or footwear unless that exact detail is visible in their reference photo; if they are wearing shoes, do not show them holding another pair. Each person's height must match their reference—if the reference shows an adult, draw adult height; if a child, draw child height; do not arbitrarily make one person look like a religious figure or shrink them. `
        : '';
    // When multiple reference images: they are DIFFERENT people — do not blend or mix; do not transfer accessories between them.
    // Hat rule: only the person whose reference shows a hat may wear a hat; never copy one person's hat onto another—never draw the same hat on two people.
    const hatOnlyOnOwnerInstruction = allRefsAreUserCharacters && numUserRefs >= 2
        ? ` CRITICAL — Hats and accessories: Look at EACH reference photo. Only the person whose OWN reference photo shows a hat/cap may be drawn wearing a hat. If Reference Image 1 has NO hat, the person from Image 1 must be drawn with NO hat—never give them a hat from another reference. If Reference Image 2 has a hat, ONLY the person from Image 2 may wear that hat—never put the same hat on the person from Image 1 or 3. Never draw identical hats on multiple people. Never copy one character's hat onto another character. Each person gets ONLY what is in their own photo. `
        : '';
    const multiPersonInstruction = referenceImages.length >= 2
        ? allRefsAreUserCharacters
            ? ` CRITICAL — these reference images are DIFFERENT people (e.g. two or three children). Do NOT blend, combine, or mix their faces or appearances. You MUST include all ${numUserRefs} people in this scene; do not omit any. Each person must look ONLY like their own reference: Image 1 = first person—use ONLY Image 1 for their face, hair, clothing, and accessories (if Image 1 has no cap, do not draw a cap on them; if Image 1 has a cap, ONLY the person from Image 1 may wear a cap—never put that cap on the person from Image 2 or 3). Image 2 = second person—use ONLY Image 2; do NOT give them the first person's hat, cap, headphones, or glasses. Image 3 (if present) = third person—use ONLY Image 3; do NOT give them accessories from Image 1 or 2. Never transfer, swap, or copy accessories (hat, cap, headphones, glasses) from one person to another. A hat/cap belongs only on the person whose reference photo shows a hat/cap; glasses only on the person whose reference shows glasses. Each person keeps exactly what is visible in their own reference photo. NEVER draw the same hat on two different people—only one person can wear a hat, and only if their own reference shows a hat.${hatOnlyOnOwnerInstruction}${multiCharacterHeight} `
            : ` CRITICAL — these reference images are DIFFERENT people. Do NOT blend, combine, or mix their faces or appearances. Image 1 = the main character (the kid/user): use ONLY Image 1 for that person's face, body, clothing, and accessories. Image 2 and any later images = other characters (e.g. Jesus, Joseph, biblical figures): use ONLY their own reference image for each.${mandatoryHeightRule} Biblical characters (Jesus, Joseph, Moses, etc.) are ADULTS—draw them at adult height, the SAME scale as the main character when Image 1 is an adult. Do NOT draw Jesus or biblical figures small, short, or child-sized; they MUST be similar height to the main character when both are adults. Do NOT put the main character's clothing or accessories (e.g. hat, cap, headphones, tattoo, watch, smartwatch, modern clothes) on Jesus or any other biblical character—only the main character (Image 1) may have these; Jesus and biblical figures must look ONLY like their own reference. Biblical and story characters must keep their own traditional appearance from their reference; only the person from Image 1 may have modern accessories if they appear in Image 1. Do not transfer features (beard, hair, skin, clothing, accessories) from one reference to another.${multiCharacterHeight} `
        : '';
    const geminiPrompt = referenceImages.length
        ? allRefsAreUserCharacters
            ? `${wholeImageStyleLock}${allMustAppearInstruction}${multiUserAntiArtifacts}${personConsistencyInstruction}${multiPersonInstruction}Using the provided reference images (${refDescription}), generate one image: ${prompt} Remember: all ${numUserRefs} people must appear in the scene. Each person (Image 1, Image 2, Image 3) must match ONLY their own reference—same face, hair, clothing, and accessories as in that photo. Do not add hat, cap, or headphones to anyone unless visible in their own reference; if their reference shows a hat, draw the hat on that person only. NEVER copy one person's hat onto another—if only the child's reference has a hat, only the child may wear a hat; the other person(s) must have NO hat. Never put one person's hat, glasses, or accessories on another person. Do not draw anyone holding an extra pair of shoes. Place each character in the scene as described. ${styleClosing}`
            : `${wholeImageStyleLock}${personConsistencyInstruction}${multiPersonInstruction}Using the provided reference images (${refDescription}), generate one image: ${prompt} Remember: Image 1 (main character) only—same age, eye color, hair, clothing and accessories as in their photo (no hat/headphones unless in photo). Other characters (Image 2+) must look only like their own reference—never give Jesus or biblical figures the main character's hat, headphones, tattoo, watch, smartwatch, or modern clothes; biblical characters have their own traditional appearance from their reference image. Place each character in the scene as described. IMPORTANT: When both the main character and Jesus/biblical figures are adults, they must be drawn at the same adult scale—no giant main character with tiny Jesus, and no tiny main character with giant Jesus. ${styleClosing}`
        : `Generate one image: ${prompt} ${styleClosing}`;

    const parts = [{ text: geminiPrompt }];
    for (const ref of referenceImages) {
        parts.push({ inlineData: { mimeType: 'image/png', data: ref.base64 } });
    }

    try {
        const url = `${baseUrl}/projects/${projectId}/locations/${location}/publishers/google/models/${imageModel}:generateContent`;
        const res = await axios.post(
            url,
            {
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio: String(aspectRatio || '9:16').trim() || '9:16' },
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
            const bodyPreview = typeof res.data === 'string'
                ? res.data.slice(0, 200)
                : (res.data ? JSON.stringify(res.data).slice(0, 200) : '');
            console.warn(
                'MonthlyBookGenerator: Gemini page', pageNumber, 'failed', res.status,
                res.status === 429 ? '(rate limit)' : '',
                `model=${imageModel}`,
                `location=${location}`,
                bodyPreview
            );
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
        console.log('MonthlyBookGenerator: Generated page', pageNumber, 'with Vertex Gemini image model', imageModel, imageUrl);
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
 * The Gemini flash image model uses Standard PayGo (shared capacity). Use exponential backoff on 429
 * and smooth request rate (delay between pages). See:
 * https://cloud.google.com/vertex-ai/generative-ai/docs/standard-paygo
 * https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/error-code-429
 */
/** Delay in ms between generating one page and the next (smooth request rate). Override with MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS. */
const DELAY_BETWEEN_PAGES_MS = parseInt(process.env.MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS, 10) || 5000;

/**
 * Generate one page background image for Book-based flow. Gemini flash image only; retries up to PAGE_GEMINI_MAX_ATTEMPTS.
 * No Imagen fallback. Uses page.sceneDescription or page text + character style; uploads to GCS and returns URL.
 * mainCharacterStyleDesc: style for the main character (kid) only.
 * wholeBookStyleDesc: style for the entire book (all characters + environment); can differ from main character.
 * Throws if all Gemini attempts fail or credentials/GCS missing.
 */
async function generatePageImageForBook(customBook, pageDoc, characterStylePrompt, pageIndex, mainCharacterStyleDesc, wholeBookStyleDesc, aspectRatio = '9:16') {
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
    let imageModel = VERTEX_IMAGE_MODEL;
    for (let attempt = 1; attempt <= PAGE_GEMINI_MAX_ATTEMPTS; attempt++) {
        const attemptOffset = attempt - 1; // 0 = first try, 1 = first retry (different region), etc.
        const { imageUrl: geminiUrl, httpStatus } = await generatePageImageWithVertexGemini(
            customBook, pageDoc, characterStylePrompt, pageIndex, attemptOffset,
            mainCharacterStyleDesc, wholeBookStyleDesc, imageModel, aspectRatio
        );
        if (geminiUrl) return geminiUrl;
        lastHttpStatus = httpStatus;
        // 404 usually means wrong endpoint/model (e.g. 3.1 on a regional URL, or project without model access).
        // Fall back once to gemini-2.5-flash-image (regional) instead of burning all retries on the same 404.
        if (httpStatus === 404 && imageModel !== VERTEX_IMAGE_FALLBACK_MODEL) {
            console.warn(
                'MonthlyBookGenerator: Gemini page', pageNumber,
                'model', imageModel, 'returned 404; falling back to', VERTEX_IMAGE_FALLBACK_MODEL
            );
            imageModel = VERTEX_IMAGE_FALLBACK_MODEL;
            _vertexImageModelLogged = false; // log the new model once
            continue;
        }
        if (attempt < PAGE_GEMINI_MAX_ATTEMPTS) {
            const delayMs = vertexBackoffMs(attempt, httpStatus === 429);
            const retryHint = VERTEX_IMAGE_GLOBAL_ONLY_MODELS.has(imageModel)
                ? 'same global endpoint'
                : 'different region';
            console.log(
                'MonthlyBookGenerator: Gemini page', pageNumber, 'attempt', attempt,
                'failed' + (httpStatus === 429 ? ' (429 rate limit)' : '') +
                '; exponential backoff: retrying in', delayMs, 'ms (' + retryHint + ')...'
            );
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error('Page ' + pageNumber + ': Gemini flash image failed after ' + PAGE_GEMINI_MAX_ATTEMPTS + ' attempts (last status ' + lastHttpStatus + ', model ' + imageModel + '). Use exponential backoff; consider MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS or Provisioned Throughput.');
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
async function runMonthlyBookGenerationFromBook(customMonthlyBookId, custom, sourceBook, generationNonce) {
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
        // Check if a newer generation (retry) has taken over — if so, stop gracefully
        if (generationNonce) {
            const fresh = await CustomMonthlyBook.findById(customMonthlyBookId).select('generationNonce status').lean();
            if (!fresh || fresh.status === 'completed' || fresh.status === 'failed' || (fresh.generationNonce && fresh.generationNonce !== generationNonce)) {
                console.log(`MonthlyBookGenerator: [${bookIdShort}] Nonce changed or status terminal — another process took over. Stopping. (ours=${generationNonce}, current=${fresh?.generationNonce})`);
                return;
            }
        }
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
            // Copy characterVoices from template so @Jesus, @Moses, etc. use the correct voices
            const charVoices = Array.isArray(sourceBook.characterVoices) && sourceBook.characterVoices.length > 0
                ? sourceBook.characterVoices.map((cv) => ({
                    characterName: cv.characterName,
                    voiceId: cv.voiceId,
                    color: cv.color || undefined,
                }))
                : [];
            if (charVoices.length > 0) {
                console.log(`MonthlyBookGenerator: [${bookIdShort}] Copying ${charVoices.length} character voice(s):`, charVoices.map((c) => c.characterName).join(', '));
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
                characterVoices: charVoices,
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
    const notificationUserId = (custom.rawUserId && String(custom.rawUserId).trim()) || (custom.userId && custom.userId.toString());
    await sendNotificationToUser({
        userId: notificationUserId,
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
    const nonce = crypto.randomBytes(8).toString('hex');
    if (custom.status === 'pending' || isResume) {
        if (custom.status === 'pending') {
            const updated = await CustomMonthlyBook.findOneAndUpdate(
                { _id: customMonthlyBookId, status: 'pending' },
                { $set: { status: 'generating', generationNonce: nonce } },
                { new: true }
            );
            if (!updated) {
                console.log('MonthlyBookGenerator: Book already claimed or not pending', customMonthlyBookId);
                return;
            }
            custom = updated;
        } else {
            // Atomically set our nonce so any previous generation process detects it changed and stops
            await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, { $set: { generationNonce: nonce } });
            custom = await CustomMonthlyBook.findById(customMonthlyBookId).populate('templateId').lean();
            console.log('MonthlyBookGenerator: Resuming', customMonthlyBookId, 'from page', custom.progressPage + 1, 'of', custom.progressTotalPages, 'nonce', nonce);
        }
    } else {
        console.log('MonthlyBookGenerator: Skipping', customMonthlyBookId, custom.status);
        return;
    }

    try {
        if (custom.sourceBookId) {
            const sourceBook = await Book.findById(custom.sourceBookId).populate('featuredCharacterId').lean();
            if (!sourceBook) throw new Error('Source book not found');
            await runMonthlyBookGenerationFromBook(customMonthlyBookId, custom, sourceBook, nonce);
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
            if (nonce) {
                const fresh = await CustomMonthlyBook.findById(customMonthlyBookId).select('generationNonce status').lean();
                if (!fresh || fresh.status === 'completed' || fresh.status === 'failed' || (fresh.generationNonce && fresh.generationNonce !== nonce)) {
                    console.log('MonthlyBookGenerator: Template flow — nonce changed, stopping.');
                    return;
                }
            }
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
        const notificationUserId = (custom.rawUserId && String(custom.rawUserId).trim()) || (custom.userId && custom.userId.toString());
        await sendNotificationToUser({
            userId: notificationUserId,
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

/**
 * Upload a PNG buffer to GCS under monthly-books/ and return a public URL.
 */
async function uploadPageImageBuffer(bookId, pageNumber, buffer) {
    if (!bucket) {
        throw new Error('GCS bucket not configured (GCS_BUCKET_NAME). Cannot upload page image.');
    }
    const hash = crypto
        .createHash('md5')
        .update(String(bookId) + pageNumber + Date.now())
        .digest('hex')
        .slice(0, 8);
    const filename = `monthly-books/${bookId}/page-${pageNumber}-${hash}.png`;
    const blob = bucket.file(filename);
    await blob.save(buffer, {
        metadata: { contentType: 'image/png', cacheControl: 'public, max-age=86400' },
    });
    await blob.makePublic().catch(() => {});
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

/**
 * Generate one page image with OpenAI GPT Image (default gpt-image-2).
 * When SavedCharacter reference photos exist, uses /v1/images/edits with those inputs
 * (same character-ref idea as Gemini). Without refs, uses /v1/images/generations + text prompt.
 */
async function generatePageImageWithOpenAI(customBook, pageDoc, characterStylePrompt, pageIndex, wholeBookStyleDesc, aspectRatio = '9:16') {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        const err = new Error(
            'OPENAI_API_KEY is not configured. Set it on the backend to use ChatGPT / OpenAI image generation.',
        );
        err.status = 503;
        throw err;
    }
    if (!bucket) {
        throw new Error('GCS bucket not configured (GCS_BUCKET_NAME). Cannot upload page image.');
    }

    const pageNumber = pageIndex + 1;
    const imageSize = openaiSizeForAspectRatio(aspectRatio);
    const compositionHint = compositionHintForAspectRatio(aspectRatio);
    const characterNames =
        customBook.characters && customBook.characters.length > 0
            ? customBook.characters
                  .map((c) => (c && c.name && String(c.name).trim()) || '')
                  .filter(Boolean)
            : [customBook.childName].filter(Boolean);
    const { prompt } = await buildScenePrompt(
        pageDoc,
        characterStylePrompt,
        customBook.childName,
        wholeBookStyleDesc,
        characterNames,
    );
    const referenceImages = await gatherPageReferenceImages(customBook, pageDoc);
    const model = OPENAI_IMAGE_MODEL;

    let openaiPrompt = prompt;
    if (referenceImages.length) {
        const refLines = referenceImages
            .map(
                (r, i) =>
                    `Reference image ${i + 1} is ${r.label} — match their appearance (face, hair, clothing, age) from that photo.`,
            )
            .join(' ');
        openaiPrompt =
            `${refLines} Create a new children's Bible storybook illustration (not a photo edit collage): ${prompt} ` +
            `Include every referenced character when the scene calls for them. ${compositionHint}, no text in image.`;
    } else {
        openaiPrompt = `${prompt} ${compositionHint}, no text in image.`;
    }

    console.log(
        'MonthlyBookGenerator: OpenAI page',
        pageNumber,
        'model:',
        model,
        'size:',
        imageSize,
        'aspect:',
        aspectRatio,
        'refs:',
        referenceImages.length,
        'prompt:',
        openaiPrompt.slice(0, 100) + (openaiPrompt.length > 100 ? '...' : ''),
    );

    let imageBase64 = null;

    if (referenceImages.length > 0) {
        const form = new FormData();
        form.append('model', model);
        form.append('prompt', openaiPrompt.slice(0, 32000));
        form.append('size', imageSize);
        form.append('n', '1');
        // Preserve character likeness from reference photos when supported
        form.append('input_fidelity', 'high');
        for (let i = 0; i < referenceImages.length; i++) {
            const buf = Buffer.from(referenceImages[i].base64, 'base64');
            form.append('image', buf, {
                filename: `ref-${i + 1}.png`,
                contentType: 'image/png',
            });
        }
        const editRes = await axios.post('https://api.openai.com/v1/images/edits', form, {
            headers: {
                Authorization: `Bearer ${openaiKey}`,
                ...form.getHeaders(),
            },
            timeout: 180000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            validateStatus: () => true,
        });
        if (editRes.status !== 200) {
            const errText =
                typeof editRes.data === 'string'
                    ? editRes.data.slice(0, 400)
                    : JSON.stringify(editRes.data || {}).slice(0, 400);
            console.warn(
                'MonthlyBookGenerator: OpenAI edits page',
                pageNumber,
                'failed',
                editRes.status,
                errText,
            );
            throw new Error(
                `OpenAI image edit failed for page ${pageNumber} (HTTP ${editRes.status}): ${errText}`,
            );
        }
        imageBase64 = editRes.data?.data?.[0]?.b64_json || null;
    } else {
        const genRes = await axios.post(
            'https://api.openai.com/v1/images/generations',
            {
                model,
                prompt: openaiPrompt.slice(0, 32000),
                n: 1,
                size: imageSize,
            },
            {
                headers: {
                    Authorization: `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 180000,
                validateStatus: () => true,
            },
        );
        if (genRes.status !== 200) {
            const errText =
                typeof genRes.data === 'string'
                    ? genRes.data.slice(0, 400)
                    : JSON.stringify(genRes.data || {}).slice(0, 400);
            console.warn(
                'MonthlyBookGenerator: OpenAI generations page',
                pageNumber,
                'failed',
                genRes.status,
                errText,
            );
            throw new Error(
                `OpenAI image generation failed for page ${pageNumber} (HTTP ${genRes.status}): ${errText}`,
            );
        }
        imageBase64 = genRes.data?.data?.[0]?.b64_json || null;
        // dall-e-3 fallback may return url instead of b64
        if (!imageBase64 && genRes.data?.data?.[0]?.url) {
            const imgRes = await axios.get(genRes.data.data[0].url, {
                responseType: 'arraybuffer',
                timeout: 60000,
            });
            imageBase64 = Buffer.from(imgRes.data).toString('base64');
        }
    }

    if (!imageBase64) {
        throw new Error(`OpenAI returned no image data for page ${pageNumber}`);
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    const imageUrl = await uploadPageImageBuffer(customBook._id, pageNumber, buffer);
    console.log(
        'MonthlyBookGenerator: Generated page',
        pageNumber,
        'with OpenAI',
        model,
        imageUrl,
    );
    return imageUrl;
}

/**
 * Generate one page image for Bible Map (or other portal book flows).
 * Providers:
 * - gemini (default): Vertex Gemini flash-image + SavedCharacter reference images
 * - openai / chatgpt: OpenAI GPT Image (gpt-image-2) with optional reference images via edits
 */
async function generatePageImageForBibleMap(bookId, pageDoc, pageIndex, options = {}) {
    const customBook = {
        _id: bookId,
        childName: '',
        childCharacterImageUrl: null,
        characters: [],
    };
    const characterStylePrompt =
        options.stylePrompt ||
        "Illustrated children's Bible storybook style, soft watercolor and digital painting blend, warm inviting colors";
    const wholeBookStyleDesc =
        options.wholeBookStyle ||
        "Illustrated children's Bible storybook, consistent soft painted look across pages";
    const provider = String(options.imageProvider || 'gemini')
        .trim()
        .toLowerCase();
    // Bible Map: 3:4 art above parchment/scroll (not full-bleed 9:16)
    const aspectRatio = String(options.aspectRatio || BIBLE_MAP_ASPECT_RATIO).trim() || BIBLE_MAP_ASPECT_RATIO;

    if (provider === 'openai' || provider === 'chatgpt') {
        return generatePageImageWithOpenAI(
            customBook,
            pageDoc,
            characterStylePrompt,
            pageIndex,
            wholeBookStyleDesc,
            aspectRatio,
        );
    }

    return generatePageImageForBook(
        customBook,
        pageDoc,
        characterStylePrompt,
        pageIndex,
        null,
        wholeBookStyleDesc,
        aspectRatio,
    );
}

module.exports = {
    runMonthlyBookGeneration,
    generatePageImageForBook,
    generatePageImageForBibleMap,
    generatePageImageWithOpenAI,
};
