/**
 * Quality + safety check for family Hub series reviews.
 *
 * Layer 1 (always): deterministic filters — length, spam, blocked language,
 * keyboard smash, and "is this actually a useful note?".
 * Layer 2 (optional): OpenAI moderation-style pass when OPENAI_API_KEY is set.
 * If the key is missing, Layer 1 is the gate (fail closed — garbage is rejected).
 * If the key is set but the call fails, the review is held as pending rather
 * than published.
 */

const MAX_LEN = 280;
const SOCIAL_MAX_LEN = 800;
const MIN_INFORMATIVE_CHARS = 12;
const MIN_INFORMATIVE_WORDS = 3;
const LLM_TIMEOUT_MS = 5000;

const MESSAGES = {
    links: 'Please leave a note without links or email addresses.',
    vulgar: 'Please keep your note kid-friendly — no swearing, slang, or adult topics.',
    nonsense: 'That note looks like typing practice. Please write a short, real sentence about the series.',
    uninformative: 'Please add a short, specific note (what your child liked or learned), or leave the box empty for stars only.',
    notKidFriendly: 'Please keep the note kind and appropriate for families with kids.',
    checkFailed: 'We could not finish checking this review. Please try again in a moment.',
};

/** Same Layer-1 reasons as reviews, wording that is not review/stars-specific. */
const SOCIAL_MESSAGES = {
    empty: 'Please write a short, real note.',
    links: 'Please leave a note without links or email addresses.',
    vulgar: 'Please keep your note kid-friendly — no swearing, slang, or adult topics.',
    nonsense: 'That note looks like typing practice. Please write a short, real sentence.',
    uninformative: 'Please add a short, specific note (what you liked or learned).',
    notKidFriendly: 'Please keep the note kind and appropriate for families with kids.',
    checkFailed: 'We could not finish checking this note. Please try again in a moment.',
};

const FILLER_WORDS = new Set([
    'a', 'an', 'and', 'are', 'awesome', 'bad', 'best', 'but', 'cool', 'excellent',
    'fine', 'fun', 'good', 'great', 'i', 'im', 'is', 'it', 'its', 'just', 'like',
    'liked', 'lol', 'love', 'loved', 'lmao', 'meh', 'my', 'nice', 'no', 'ok',
    'okay', 'omg', 'or', 'our', 'perfect', 'pretty', 'quite', 'really', 'so',
    'super', 'that', 'the', 'this', 'too', 'very', 'was', 'we', 'wonderful',
    'wow', 'yes', 'you',
]);

/** Strong profanity, sexual terms, slurs, and adult/violent topics. */
const BLOCKED_WORDS = [
    'anal', 'anus', 'ass', 'asshole', 'bastard', 'bitch', 'blowjob', 'boner',
    'boob', 'boobs', 'clit', 'cock', 'crap', 'cum', 'cunt', 'damn', 'dick',
    'dildo', 'dumb', 'fag', 'faggot', 'fuck', 'fucker', 'fucking', 'hentai',
    'horny', 'idiot', 'jerkoff', 'kike', 'kill', 'kys', 'lesbiansex', 'lmfao',
    'masturbat', 'milf', 'nazi', 'nigga', 'nigger', 'nude', 'nudes', 'orgasm',
    'pedo', 'penis', 'piss', 'porn', 'pussy', 'rape', 'rapist', 'retard',
    'retarded', 'sex', 'sexy', 'shit', 'slut', 'sperm', 'stupid', 'suck',
    'sucks', 'tits', 'vagina', 'wank', 'whore', 'wtf',
];

const BLOCKED_PHRASES = [
    'what the hell', 'go to hell', 'hell no', 'to hell with',
    'kill yourself', 'kill him', 'kill her', 'kill them', 'kill kids',
    'hook up', 'make out', 'turned on',
];

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

const KEY_NEIGHBORS = (() => {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const map = new Map();
    rows.forEach((row, r) => {
        for (let i = 0; i < row.length; i++) {
            const near = new Set();
            if (i > 0) near.add(row[i - 1]);
            if (i < row.length - 1) near.add(row[i + 1]);
            if (r > 0 && rows[r - 1][i]) near.add(rows[r - 1][i]);
            if (r < rows.length - 1 && rows[r + 1][i]) near.add(rows[r + 1][i]);
            map.set(row[i], near);
        }
    });
    return map;
})();

function tidy(raw, maxLen = MAX_LEN) {
    return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function wordsOf(text) {
    return text.toLowerCase().match(/[a-z']+/g) || [];
}

function leetFold(text) {
    return text
        .toLowerCase()
        .replace(/[@4]/g, 'a')
        .replace(/[0]/g, 'o')
        .replace(/[1!|]/g, 'i')
        .replace(/[3]/g, 'e')
        .replace(/[5$]/g, 's')
        .replace(/[7]/g, 't')
        .replace(/[+]/g, 't');
}

function compactLetters(text) {
    return leetFold(text).replace(/[^a-z]/g, '');
}

function hasUrlOrEmail(text) {
    return /https?:\/\/|www\.|[\w.-]+@[\w.-]+\.[a-z]{2,}/i.test(text);
}

function hasBlockedLanguage(text) {
    const folded = leetFold(text);
    if (BLOCKED_PHRASES.some((phrase) => folded.includes(phrase))) return true;
    const wordRe = new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\b`, 'i');
    if (wordRe.test(folded)) return true;
    const smashed = compactLetters(text);
    return BLOCKED_WORDS.some((word) => word.length >= 4 && smashed.includes(word));
}

function isKeyboardWalk(compact) {
    if (compact.length < 6) return false;
    for (const row of KEYBOARD_ROWS) {
        const rev = row.split('').reverse().join('');
        if (row.includes(compact) || rev.includes(compact)) return true;
    }
    let adjacent = 0;
    for (let i = 1; i < compact.length; i++) {
        const near = KEY_NEIGHBORS.get(compact[i - 1]);
        if (near && near.has(compact[i])) adjacent += 1;
    }
    return compact.length >= 8 && adjacent / (compact.length - 1) >= 0.7;
}

function looksLikeNonsense(text) {
    const compact = compactLetters(text);
    if (/(.)\1{4,}/i.test(text.replace(/\s/g, ''))) return true;
    if (/^[^a-z0-9]+$/i.test(text)) return true;
    if (isKeyboardWalk(compact)) return true;
    const words = wordsOf(text);
    if (words.length === 0) return true;
    const vowelWords = words.filter((w) => /[aeiouy]/.test(w));
    if (compact.length >= 8 && vowelWords.length === 0) return true;
    const shortGibberish = words.filter((w) => w.length >= 5 && !/[aeiouy]/.test(w));
    if (shortGibberish.length > 0 && shortGibberish.length === words.length) return true;
    return false;
}

function isUninformative(text) {
    if (text.length < MIN_INFORMATIVE_CHARS) return true;
    const words = wordsOf(text);
    if (words.length < MIN_INFORMATIVE_WORDS) return true;
    const content = words.filter((w) => w.length >= 4 && !FILLER_WORDS.has(w));
    return content.length === 0;
}

/**
 * Sync Layer-1 check.
 * @param {string} raw
 * @param {{ maxLen?: number, emptyOk?: boolean, messages?: Record<string, string> }} [options]
 * @returns {{ ok: true, comment: string, starOnly?: boolean } | { ok: false, error: string, reason: string }}
 */
function checkTextDeterministic(raw, options = {}) {
    const maxLen = options.maxLen || MAX_LEN;
    const emptyOk = options.emptyOk !== false;
    const messages = options.messages || MESSAGES;
    const comment = tidy(raw, maxLen);
    if (!comment) {
        if (emptyOk) return { ok: true, comment: '', starOnly: true };
        return { ok: false, error: messages.empty || messages.uninformative, reason: 'empty' };
    }

    if (hasUrlOrEmail(comment)) {
        return { ok: false, error: messages.links, reason: 'links' };
    }
    if (hasBlockedLanguage(comment)) {
        return { ok: false, error: messages.vulgar, reason: 'vulgar' };
    }
    if (looksLikeNonsense(comment)) {
        return { ok: false, error: messages.nonsense, reason: 'nonsense' };
    }
    if (isUninformative(comment)) {
        return { ok: false, error: messages.uninformative, reason: 'uninformative' };
    }
    return { ok: true, comment };
}

/**
 * Sync Layer-1 check. Star-only (empty comment) always passes.
 * @returns {{ ok: true, comment: string, starOnly?: boolean } | { ok: false, error: string, reason: string }}
 */
function checkReviewCommentDeterministic(raw) {
    return checkTextDeterministic(raw, { maxLen: MAX_LEN, emptyOk: true, messages: MESSAGES });
}

function mapLlmReason(reason) {
    switch (String(reason || '')) {
        case 'vulgar':
            return MESSAGES.vulgar;
        case 'nonsense':
            return MESSAGES.nonsense;
        case 'uninformative':
            return MESSAGES.uninformative;
        default:
            return MESSAGES.notKidFriendly;
    }
}

async function moderateWithLlm(comment) {
    const key = (process.env.OPENAI_API_KEY || '').trim();
    if (!key) return { used: false, ok: true };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0,
                max_tokens: 80,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You moderate a parent review for a Christian children\'s Bible app. ' +
                            'Kids and parents will read this. Approve only if the text is kid-friendly ' +
                            '(no swearing, slurs, sexual content, graphic violence, or adult topics), ' +
                            'real language (not nonsense or spam), and informative — a short specific ' +
                            'note about the series. Reply with JSON only: ' +
                            '{"ok":true} or {"ok":false,"reason":"vulgar"|"nonsense"|"not_kid_friendly"|"uninformative"}. ' +
                            'No extra text.',
                    },
                    { role: 'user', content: comment },
                ],
            }),
        });
        if (!response.ok) {
            return { used: true, error: true };
        }
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { used: true, error: true };
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.ok === true) return { used: true, ok: true };
        return { used: true, ok: false, reason: parsed.reason || 'not_kid_friendly' };
    } catch (err) {
        return { used: true, error: true };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Full Layer-1 + optional LLM check. Used by reviews and creator social writes.
 * @param {string} raw
 * @param {{ maxLen?: number, emptyOk?: boolean, messages?: Record<string, string> }} [options]
 * @returns {Promise<{
 *   ok: true, comment: string, status: 'published'|'pending', pendingReason?: string
 * } | { ok: false, error: string, reason: string }>}
 */
async function checkKidSafeText(raw, options = {}) {
    const det = checkTextDeterministic(raw, {
        maxLen: options.maxLen || MAX_LEN,
        emptyOk: options.emptyOk !== false,
        messages: options.messages || MESSAGES,
    });
    if (!det.ok) return det;
    if (det.starOnly) return { ok: true, comment: '', status: 'published' };

    const llm = await moderateWithLlm(det.comment);
    if (!llm.used) {
        return { ok: true, comment: det.comment, status: 'published' };
    }
    if (llm.error) {
        return {
            ok: true,
            comment: det.comment,
            status: 'pending',
            pendingReason: 'moderation_unavailable',
        };
    }
    if (!llm.ok) {
        const messages = options.messages || MESSAGES;
        const mapped = mapLlmReason(llm.reason);
        const error = mapped === MESSAGES.notKidFriendly
            ? (messages.notKidFriendly || mapped)
            : (messages[llm.reason] || mapped);
        return { ok: false, error, reason: llm.reason || 'not_kid_friendly' };
    }
    return { ok: true, comment: det.comment, status: 'published' };
}

/**
 * Full check used by POST /hub/playlists/:id/reviews.
 * @returns {Promise<{
 *   ok: true, comment: string, status: 'published'|'pending', pendingReason?: string
 * } | { ok: false, error: string, reason: string }>}
 */
async function checkReviewComment(raw) {
    return checkKidSafeText(raw, { maxLen: MAX_LEN, emptyOk: true, messages: MESSAGES });
}

/**
 * Posts, comments, and wall notes — same filters as reviews, empty text rejected.
 */
async function checkSocialText(raw, options = {}) {
    return checkKidSafeText(raw, {
        maxLen: options.maxLen || SOCIAL_MAX_LEN,
        emptyOk: options.emptyOk === true,
        messages: options.messages || SOCIAL_MESSAGES,
    });
}

/** Sync wrapper kept for any caller that only needs Layer 1. */
function sanitizeKidComment(raw) {
    const det = checkReviewCommentDeterministic(raw);
    if (!det.ok) return { error: det.error };
    return { comment: det.comment };
}

const ANONYMOUS_DISPLAY_NAME = 'A family';
const LEGACY_ANONYMOUS_NAMES = new Set(['a family', 'a parent', 'anonymous']);
const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 24;
const DISPLAY_NAME_RE = /^[A-Za-z0-9 ]+$/;

const NAME_MESSAGES = {
    length: 'Username must be 2–24 letters, numbers, or spaces.',
    charset: 'Username can only use letters, numbers, and spaces.',
    links: 'Please pick a name without links or email addresses.',
    vulgar: 'Please pick a kid-friendly username.',
};

/**
 * Public display name for a named review. Empty comment / star-only is fine;
 * the name itself still has to be short, alphanumeric, and kid-safe.
 */
function checkReviewDisplayName(raw) {
    const displayName = String(raw || '').replace(/\s+/g, ' ').trim();
    if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) {
        return { ok: false, error: NAME_MESSAGES.length, reason: 'length' };
    }
    if (!DISPLAY_NAME_RE.test(displayName)) {
        return { ok: false, error: NAME_MESSAGES.charset, reason: 'charset' };
    }
    if (hasUrlOrEmail(displayName)) {
        return { ok: false, error: NAME_MESSAGES.links, reason: 'links' };
    }
    if (hasBlockedLanguage(displayName)) {
        return { ok: false, error: NAME_MESSAGES.vulgar, reason: 'vulgar' };
    }
    return { ok: true, displayName };
}

function reviewIsAnonymous(review) {
    if (review && typeof review.anonymous === 'boolean') return review.anonymous;
    return LEGACY_ANONYMOUS_NAMES.has(String(review?.displayName || '').trim().toLowerCase());
}

function publicReviewDisplayName(review) {
    if (reviewIsAnonymous(review)) return ANONYMOUS_DISPLAY_NAME;
    const name = String(review?.displayName || '').trim();
    return name || ANONYMOUS_DISPLAY_NAME;
}

/** Default is anonymous when the client omits the flag. */
function resolveReviewAttribution(body) {
    const anonymous = !(body?.anonymous === false || body?.anonymous === 'false');
    if (anonymous) {
        return { ok: true, anonymous: true, displayName: ANONYMOUS_DISPLAY_NAME };
    }
    const named = checkReviewDisplayName(body?.displayName);
    if (!named.ok) return named;
    return { ok: true, anonymous: false, displayName: named.displayName };
}

module.exports = {
    sanitizeKidComment,
    checkReviewComment,
    checkReviewCommentDeterministic,
    checkKidSafeText,
    checkSocialText,
    checkTextDeterministic,
    checkReviewDisplayName,
    reviewIsAnonymous,
    publicReviewDisplayName,
    resolveReviewAttribution,
    ANONYMOUS_DISPLAY_NAME,
    MESSAGES,
    SOCIAL_MESSAGES,
    MAX_LEN,
    SOCIAL_MAX_LEN,
};
