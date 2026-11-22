const test = require('node:test');
const assert = require('node:assert/strict');
const { RULES } = require('../../src/services/smartNotifications/rules');
const { HOUR, DAY, NOW, ago, makeCatalog, makeState } = require('./fixtures');

const rule = (id) => RULES.find((r) => r.id === id);
const run = (id, state, catalog = makeCatalog()) => rule(id).evaluate(state, catalog, NOW);

const done = (...days) => days.map(([day, when]) => ({ gameId: `creation-day-${day}`, completedAt: when }));

test('track_unlock: Day 2 of Creation Week unlocks after Day 1 is completed and the wait has passed', () => {
    const [candidate] = run('track_unlock', makeState({ completedGames: done([1, ago(20 * HOUR)]) }));
    assert.equal(candidate.dedupeKey, 'track:creation_week:2');
    assert.equal(candidate.title, '🎮 New game unlocked: Day 2 of Creation Week!');
    assert.match(candidate.message, /sky and the waters/);
    assert.equal(candidate.imageUrl, 'day2.png');
});

test('track_unlock: advances day by day (Day 4 after Days 1-3)', () => {
    const state = makeState({ completedGames: done([1, ago(3 * DAY)], [2, ago(2 * DAY)], [3, ago(19 * HOUR)]) });
    assert.equal(run('track_unlock', state)[0].data.day, 4);
});

test('track_unlock: nothing before the unlock interval, after the stale window, before starting, or after finishing', () => {
    assert.deepEqual(run('track_unlock', makeState({ completedGames: done([1, ago(2 * HOUR)]) })), []);
    assert.deepEqual(run('track_unlock', makeState({ completedGames: done([1, ago(15 * DAY)]) })), []);
    assert.deepEqual(run('track_unlock', makeState({})), []);
    const all = done(...[1, 2, 3, 4, 5, 6, 7].map((d) => [d, ago((8 - d) * DAY)]));
    assert.deepEqual(run('track_unlock', makeState({ completedGames: all })), []);
});

test('track_unlock: ignored until the track games exist in the portal', () => {
    const state = makeState({ completedGames: done([1, ago(20 * HOUR)]) });
    assert.deepEqual(run('track_unlock', state, makeCatalog({ withCreation: false })), []);
});

test('track_start: invites readers who have not started Creation Week', () => {
    const reader = makeState({ completedBooks: [{ bookId: 'jesus', completedAt: ago(DAY) }] });
    assert.equal(run('track_start', reader)[0].dedupeKey, 'track_start:creation_week');
    assert.deepEqual(run('track_start', makeState({})), []);
    const started = makeState({ completedBooks: [{ bookId: 'jesus', completedAt: ago(DAY) }], completedGames: done([1, ago(DAY)]) });
    assert.deepEqual(run('track_start', started), []);
});

test('book_games_unlocked: announces bonus games for a book finished in the last week', () => {
    const [candidate] = run('book_games_unlocked', makeState({ completedBooks: [{ bookId: 'noah1', completedAt: ago(DAY) }] }));
    assert.equal(candidate.dedupeKey, 'book_games:noah1');
    assert.equal(candidate.title, '🎮 New game unlocked: Animal Match!');
    assert.equal(candidate.url, '/#/book/noah1');
    assert.deepEqual(run('book_games_unlocked', makeState({ completedBooks: [{ bookId: 'noah1', completedAt: ago(30 * 60 * 1000) }] })), []);
    assert.deepEqual(run('book_games_unlocked', makeState({ completedBooks: [{ bookId: 'noah1', completedAt: ago(8 * DAY) }] })), []);
    assert.deepEqual(run('book_games_unlocked', makeState({ completedBooks: [{ bookId: 'jonah', completedAt: ago(DAY) }] })), []);
});

test('continue_reading: nudges to finish a book left part-way, with pages remaining', () => {
    const [candidate] = run('continue_reading', makeState({ inProgressBooks: [{ bookId: 'david', pageIndex: 6, lastReadAt: ago(2 * DAY) }] }));
    assert.equal(candidate.dedupeKey, 'continue:david');
    assert.equal(candidate.message, "You're on page 7 of 10. Only 3 pages to go!");
});

test('continue_reading: skips fresh, stale, barely-started, finished and unknown-length books', () => {
    const cases = [
        { bookId: 'david', pageIndex: 6, lastReadAt: ago(2 * HOUR) },
        { bookId: 'david', pageIndex: 6, lastReadAt: ago(11 * DAY) },
        { bookId: 'david', pageIndex: 0, lastReadAt: ago(2 * DAY) },
        { bookId: 'david', pageIndex: 9, lastReadAt: ago(2 * DAY) },
        { bookId: 'noah2', pageIndex: 3, lastReadAt: ago(2 * DAY) },
    ];
    for (const progress of cases) {
        assert.deepEqual(run('continue_reading', makeState({ inProgressBooks: [progress] })), [], JSON.stringify(progress));
    }
});

test('next_in_series: recommends the next book by series order', () => {
    const [candidate] = run('next_in_series', makeState({ completedBooks: [{ bookId: 'noah1', completedAt: ago(DAY) }] }));
    assert.equal(candidate.dedupeKey, 'next:noah2');
    assert.equal(candidate.title, '📚 Next story: "The Great Flood"');
    assert.match(candidate.message, /You finished "Noah Builds the Ark"/);
});

test('next_in_series: skips members-only books for free users but offers them to subscribers', () => {
    const progress = { completedBooks: [{ bookId: 'noah1', completedAt: ago(2 * DAY) }, { bookId: 'noah2', completedAt: ago(DAY) }] };
    assert.deepEqual(run('next_in_series', makeState(progress)), []);
    assert.equal(run('next_in_series', makeState(progress, { subscriptionStatus: 'active' }))[0].dedupeKey, 'next:noah3');
});

test('next_in_series: does not suggest a book already in progress', () => {
    const state = makeState({
        completedBooks: [{ bookId: 'noah1', completedAt: ago(DAY) }],
        inProgressBooks: [{ bookId: 'noah2', pageIndex: 2, lastReadAt: ago(DAY) }],
    });
    assert.deepEqual(run('next_in_series', state), []);
});

test('recommend_book: suggests unread books from the same category, featured first', () => {
    const candidates = run('recommend_book', makeState({ completedBooks: [{ bookId: 'jonah', completedAt: ago(DAY) }] }));
    assert.equal(candidates[0].dedupeKey, 'recommend:david');
    assert.ok(candidates.every((c) => !['recommend:jonah', 'recommend:jesus', 'recommend:noah3'].includes(c.dedupeKey)));
});

test('island_tip: suggests the Starter Kitchen once the player grows food', () => {
    const island = { buildings: ['hut', 'garden'], harvestCount: 2, cookedRecipeCount: 0, updatedAt: ago(DAY) };
    const [first] = run('island_tip', makeState({ island }));
    assert.equal(first.dedupeKey, 'island_tip:starter_kitchen');
    assert.equal(first.message, 'You can learn real recipes with the food you grow! Build your Starter Kitchen.');
});

test('island_tip: tips follow what was built (kitchen built -> cook a recipe; no garden -> plant one)', () => {
    const withKitchen = { buildings: ['hut', 'garden', 'oven', 'well', 'church'], harvestCount: 1, cookedRecipeCount: 0, updatedAt: ago(DAY) };
    assert.equal(run('island_tip', makeState({ island: withKitchen }))[0].dedupeKey, 'island_tip:first_recipe');
    const noGarden = { buildings: ['tent'], harvestCount: 0, cookedRecipeCount: 0, updatedAt: ago(DAY) };
    assert.equal(run('island_tip', makeState({ island: noGarden }))[0].dedupeKey, 'island_tip:garden_bed');
});

test('island_tip: silent for players with no island or who stopped playing a month ago', () => {
    assert.deepEqual(run('island_tip', makeState({})), []);
    const stale = { buildings: ['garden'], harvestCount: 3, cookedRecipeCount: 0, updatedAt: ago(31 * DAY) };
    assert.deepEqual(run('island_tip', makeState({ island: stale })), []);
});
