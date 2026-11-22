/**
 * Rules test for in-progress Godly Hub series (no database needed).
 * Run: node scripts/test-hub-series.js
 */
const assert = require('assert');
const {
    sanitizeItems,
    validateItems,
    toPublicPlaylist,
    mergeEpisodeUpdate,
} = require('../src/utils/hubSeries');
const { deriveSeriesProgress } = require('../src/models/HubPlaylist');

let passed = 0;
const test = (name, fn) => {
    try {
        fn();
        passed += 1;
        console.log(`  ✓ ${name}`);
    } catch (error) {
        console.error(`  ✗ ${name}\n    ${error.message}`);
        process.exitCode = 1;
    }
};

console.log('\nsanitizeItems');
test('strips audio from a planned episode', () => {
    const [item] = sanitizeItems([
        { title: 'Ch 4', planned: true, releaseDate: '2026-10-01', audioUrl: 'sneaky.mp3', duration: 99 },
    ]);
    assert.strictEqual(item.audioUrl, undefined);
    assert.strictEqual(item.duration, undefined);
    assert.ok(item.releaseDate instanceof Date);
});

test('ignores a client-supplied reviewStatus when the caller forces one', () => {
    const [item] = sanitizeItems([{ title: 'Ch 1', audioUrl: 'a.mp3', reviewStatus: 'approved' }], {
        reviewStatus: 'pending',
    });
    assert.strictEqual(item.reviewStatus, 'pending');
});

console.log('\nvalidateItems');
test('planned episode without a release month is rejected', () => {
    assert.match(validateItems([{ title: 'Ch 4', planned: true }]), /release month/);
});
test('released episode without audio is rejected', () => {
    assert.match(validateItems([{ title: 'Ch 1' }]), /audio file/);
});
test('a valid mixed list passes', () => {
    assert.strictEqual(
        validateItems([
            { title: 'Ch 1', audioUrl: 'a.mp3' },
            { title: 'Ch 4', planned: true, releaseDate: new Date() },
        ]),
        null
    );
});

console.log('\ntoPublicPlaylist');
test('hides pending and rejected episodes from the app', () => {
    const shaped = toPublicPlaylist({
        purchaseCount: 215,
        items: [
            { title: 'live' },
            { title: 'in review', reviewStatus: 'pending' },
            { title: 'blocked', reviewStatus: 'rejected' },
            { title: 'planned', planned: true, reviewStatus: 'approved' },
        ],
    });
    assert.deepStrictEqual(shaped.items.map(i => i.title), ['live', 'planned']);
    assert.strictEqual(shaped.backerCount, 215);
});

console.log('\nmergeEpisodeUpdate (published series)');
const live = { _id: 'a', title: 'Ch 1', audioUrl: 'a.mp3', planned: false, reviewStatus: 'approved' };
const planned = { _id: 'b', title: 'Ch 2', planned: true, releaseDate: new Date('2026-10-01') };

test('refuses to remove an episode families already own', () => {
    const result = mergeEpisodeUpdate([live, planned], [{ ...planned }]);
    assert.match(result.error, /already live and cannot be removed/);
});

test('refuses to overwrite a live episode, even if the payload changes it', () => {
    const result = mergeEpisodeUpdate(
        [live],
        [{ _id: 'a', title: 'Hacked title', audioUrl: 'evil.mp3', planned: false }]
    );
    assert.strictEqual(result.items[0].title, 'Ch 1');
    assert.strictEqual(result.items[0].audioUrl, 'a.mp3');
    assert.strictEqual(result.newlyReleased, 0);
});

test('releasing a planned episode sends it to review, not straight to kids', () => {
    const result = mergeEpisodeUpdate(
        [live, planned],
        [live, { _id: 'b', title: 'Ch 2', planned: false, audioUrl: 'b.mp3' }]
    );
    assert.strictEqual(result.newlyReleased, 1);
    assert.strictEqual(result.items[1].reviewStatus, 'pending');
});

test('a brand new released episode also goes to review', () => {
    const result = mergeEpisodeUpdate([live], [live, { title: 'Ch 2', planned: false, audioUrl: 'b.mp3' }]);
    assert.strictEqual(result.newlyReleased, 1);
    assert.strictEqual(result.items[1].reviewStatus, 'pending');
});

test('re-scheduling a planned episode is free and stays out of the queue', () => {
    const result = mergeEpisodeUpdate(
        [live, planned],
        [live, { _id: 'b', title: 'Ch 2', planned: true, releaseDate: new Date('2026-12-01') }]
    );
    assert.strictEqual(result.newlyReleased, 0);
    assert.strictEqual(result.items[1].reviewStatus, 'approved');
});

test('dropping a planned episode is allowed', () => {
    const result = mergeEpisodeUpdate([live, planned], [live]);
    assert.ok(!result.error);
    assert.strictEqual(result.items.length, 1);
});

test('an episode still in review is not re-queued when edited', () => {
    const pending = { _id: 'c', title: 'Ch 3', audioUrl: 'c.mp3', planned: false, reviewStatus: 'pending' };
    const result = mergeEpisodeUpdate(
        [live, pending],
        [live, { _id: 'c', title: 'Ch 3 revised', audioUrl: 'c.mp3', planned: false }]
    );
    assert.strictEqual(result.newlyReleased, 0);
    assert.strictEqual(result.items[1].reviewStatus, 'pending');
});

console.log('\nderiveSeriesProgress');
test('planned episodes mark the series in progress', () => {
    const d = deriveSeriesProgress([{ title: '1' }, { title: '2', planned: true }]);
    assert.deepStrictEqual(d, { releasedEpisodeCount: 1, plannedEpisodeCount: 1, seriesStatus: 'in-progress' });
});
test('a fully released series is complete', () => {
    assert.strictEqual(deriveSeriesProgress([{ title: '1' }]).seriesStatus, 'complete');
});
test('rejected episodes do not count as released', () => {
    assert.strictEqual(
        deriveSeriesProgress([{ title: '1', reviewStatus: 'rejected' }]).releasedEpisodeCount,
        0
    );
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}\n`);
