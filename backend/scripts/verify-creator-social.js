#!/usr/bin/env node
/**
 * Kid-safe social checks + optional HTTP smoke for creator posts.
 *
 * Offline (always):
 *   node scripts/verify-creator-social.js
 *
 * Live API (needs a running backend + creator login):
 *   API_URL=http://localhost:5001 \
 *   CREATOR_EMAIL=test-creator@godlykids.com \
 *   CREATOR_PASSWORD='HubTest2026!' \
 *   node scripts/verify-creator-social.js --http
 */
'use strict';

const {
    checkSocialText,
    checkReviewCommentDeterministic,
    SOCIAL_MESSAGES,
    MESSAGES,
} = require('../src/utils/kidSafeComment');

let failures = 0;
function check(label, ok, extra) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failures += 1;
}

(async () => {
    const vulgar = await checkSocialText('This series is fucking stupid');
    check('social vulgar rejected', vulgar.ok === false && vulgar.reason === 'vulgar', vulgar.error);

    const smash = await checkSocialText('asdfghjkl');
    check('social nonsense rejected', smash.ok === false && smash.reason === 'nonsense', smash.error);

    const empty = await checkSocialText('   ');
    check('social empty rejected', empty.ok === false && empty.reason === 'empty', empty.error);

    const good = await checkSocialText('Our kids loved the bedtime story about David.');
    check('social informative accepted', good.ok === true && good.status === 'published', good.comment);

    const reviewEmpty = checkReviewCommentDeterministic('');
    check('review star-only still accepted', reviewEmpty.ok === true && reviewEmpty.starOnly === true);

    const reviewUninformative = checkReviewCommentDeterministic('good');
    check(
        'review uninformative still uses review wording',
        reviewUninformative.ok === false && reviewUninformative.error === MESSAGES.uninformative,
    );

    const socialUninformative = await checkSocialText('good');
    check(
        'social uninformative uses social wording',
        socialUninformative.ok === false && socialUninformative.error === SOCIAL_MESSAGES.uninformative,
    );

    if (process.argv.includes('--http')) {
        const api = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '');
        const email = process.env.CREATOR_EMAIL || 'test-creator@godlykids.com';
        const password = process.env.CREATOR_PASSWORD || 'HubTest2026!';
        const familyId = `social-smoke-${Date.now()}`;

        const json = async (path, options = {}) => {
            const res = await fetch(`${api}${path}`, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
            });
            const data = await res.json().catch(() => ({}));
            return { status: res.status, data };
        };

        const login = await json('/api/creator/login', { method: 'POST', body: { email, password } });
        check('creator login', login.status === 200 && Boolean(login.data.token), login.data.error);
        if (!login.data.token) {
            throw new Error('Creator login failed — cannot continue HTTP smoke');
        }
        const token = login.data.token;
        const creatorId = login.data.creator?.id || login.data.creator?._id || login.data._id;

        const created = await json('/api/hub/my-posts', {
            method: 'POST',
            token,
            body: { body: 'Our kids loved the bedtime story about David.' },
        });
        check('create post', created.status === 201 && Boolean(created.data.post?.id), created.data.error);
        const postId = created.data.post?.id;

        const feed = await json(`/api/hub/creators/${creatorId}/posts?userId=${familyId}`);
        check('public feed includes post', Boolean((feed.data.posts || []).some((p) => p.id === postId)));

        const liked = await json(`/api/hub/posts/${postId}/like`, {
            method: 'POST',
            body: { userId: familyId },
        });
        check('like', liked.status === 200 && liked.data.likedByMe === true && liked.data.likeCount >= 1, liked.data.error);

        const unliked = await json(`/api/hub/posts/${postId}/like`, {
            method: 'POST',
            body: { userId: familyId },
        });
        check('unlike', unliked.status === 200 && unliked.data.likedByMe === false, unliked.data.error);

        const goodComment = await json(`/api/hub/posts/${postId}/comments`, {
            method: 'POST',
            body: { userId: familyId, body: 'My daughter learned about kindness today.' },
        });
        check(
            'good comment',
            goodComment.status === 201 && Boolean(goodComment.data.comment?.body),
            goodComment.data.error,
        );
        check(
            'comment hides email',
            !JSON.stringify(goodComment.data).includes('@'),
        );

        const vulgarComment = await json(`/api/hub/posts/${postId}/comments`, {
            method: 'POST',
            body: { userId: familyId, body: 'This is fucking stupid' },
        });
        check(
            'vulgar comment rejected',
            vulgarComment.status === 400 && vulgarComment.data.reason === 'vulgar',
            vulgarComment.data.error,
        );

        const wall = await json(`/api/hub/creators/${creatorId}/wall`, {
            method: 'POST',
            body: { userId: familyId, body: 'Thank you for the gentle bedtime stories.' },
        });
        check('wall note', wall.status === 201 && Boolean(wall.data.note?.id), wall.data.error);

        const deleted = await json(`/api/hub/my-posts/${postId}`, { method: 'DELETE', token });
        check('delete own post', deleted.status === 200 && deleted.data.success === true, deleted.data.error);

        const anon = await json(`/api/hub/posts/${postId}/like`, {
            method: 'POST',
            body: {},
        });
        check('unauthenticated like blocked', anon.status === 400, String(anon.status));
    }

    if (failures) {
        console.error(`\n${failures} check(s) failed`);
        process.exit(1);
    }
    console.log('\nok — creator social checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
