/**
 * Verification for family Hub review quality/safety checks.
 * Run: node scripts/verify-hub-review-quality.js
 */
'use strict';

const {
    checkReviewCommentDeterministic,
    checkReviewComment,
    sanitizeKidComment,
    checkReviewDisplayName,
    resolveReviewAttribution,
    publicReviewDisplayName,
    MESSAGES,
} = require('../src/utils/kidSafeComment');

let failures = 0;
function check(label, ok, extra) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failures += 1;
}

function expectReject(label, raw, reason) {
    const result = checkReviewCommentDeterministic(raw);
    check(
        label,
        result.ok === false && (!reason || result.reason === reason),
        result.ok ? 'was accepted' : `reason=${result.reason}`,
    );
}

function expectAccept(label, raw) {
    const result = checkReviewCommentDeterministic(raw);
    check(label, result.ok === true, result.ok ? undefined : result.error);
}

expectReject('vulgar comment rejected', 'This series is fucking stupid', 'vulgar');
expectReject('keyboard smash rejected', 'asdfghjkl', 'nonsense');
expectReject('one-word good rejected', 'good', 'uninformative');
expectReject('one-word nice rejected', 'nice', 'uninformative');
expectReject('punctuation-only rejected', '!!!', 'nonsense');
expectReject('repeated chars rejected', 'sooooooooo good', 'nonsense');
expectReject('url spam rejected', 'Great story http://spam.example', 'links');
expectReject('adult topic rejected', 'Too sexy for my kids', 'vulgar');

const starOnly = checkReviewCommentDeterministic('   ');
check('star-only empty comment accepted', starOnly.ok === true && starOnly.comment === '');
check('star-only flagged', starOnly.starOnly === true);

expectAccept(
    'short informative kid-friendly comment accepted',
    'Our kids loved the bedtime story about David.',
);
expectAccept(
    'specific learning note accepted',
    'My daughter learned about kindness.',
);

const syncReject = sanitizeKidComment('asdfghjkl');
check('sanitizeKidComment still rejects garbage', Boolean(syncReject.error));
const syncAccept = sanitizeKidComment('');
check('sanitizeKidComment star-only stays empty', syncAccept.comment === '');

const namedOk = checkReviewDisplayName('  Crew Mom  ');
check('display name accepts letters and spaces', namedOk.ok === true && namedOk.displayName === 'Crew Mom');
check('display name rejects one letter', checkReviewDisplayName('A').ok === false);
check('display name rejects hyphen', checkReviewDisplayName('bad-name').ok === false);
check('display name rejects email', checkReviewDisplayName('has@email.com').ok === false);
check('display name rejects slur-like word', checkReviewDisplayName('stupid').ok === false);

const defaultAttr = resolveReviewAttribution({});
check('omitted attribution is anonymous', defaultAttr.ok === true && defaultAttr.anonymous === true && defaultAttr.displayName === 'A family');
const namedAttr = resolveReviewAttribution({ anonymous: false, displayName: 'Noahs Dad' });
check('named attribution keeps username', namedAttr.ok === true && namedAttr.anonymous === false && namedAttr.displayName === 'Noahs Dad');
const badAttr = resolveReviewAttribution({ anonymous: false, displayName: 'x' });
check('named attribution rejects short username', badAttr.ok === false);
check('legacy A parent lists as A family', publicReviewDisplayName({ displayName: 'A parent' }) === 'A family');
check('named review lists username not email', publicReviewDisplayName({ anonymous: false, displayName: 'The Smiths', userEmail: 'secret@example.com' }) === 'The Smiths');

const savedKey = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;

(async () => {
    const published = await checkReviewComment('Our kids loved the songs at bedtime.');
    check(
        'async check publishes when no LLM key',
        published.ok === true && published.status === 'published',
        published.ok ? published.status : published.error,
    );

    const rejected = await checkReviewComment('good');
    check(
        'async check still fail-closes on Layer 1',
        rejected.ok === false && rejected.error === MESSAGES.uninformative,
    );

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;

    if (failures) {
        console.log(`\n${failures} check(s) failed`);
        process.exit(1);
    }
    console.log('\nAll hub review quality checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
