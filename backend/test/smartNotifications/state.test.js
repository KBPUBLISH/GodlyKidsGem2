const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeProgressReport, mergeProgress, buildUserState } = require('../../src/services/smartNotifications/state');
const { DAY, NOW, ago } = require('./fixtures');

test('sanitizeProgressReport keeps valid ids, clamps future timestamps and drops junk', () => {
    const report = sanitizeProgressReport({
        completedBooks: ['b1', { bookId: 'b2', completedAt: '2030-01-01' }, { bookId: 'x'.repeat(65) }, { bookId: 'b3', completedAt: 'nope' }, null],
        inProgressBooks: [{ bookId: 'b4', pageIndex: 3, lastReadAt: ago(DAY).getTime() }, { bookId: 'b5', pageIndex: -1 }],
        completedGames: [{ gameId: 'creation-day-1' }],
        island: { buildings: ['garden', 42, '', { evil: true }], harvestCount: '7', cookedRecipeCount: -2 },
        parentNotes: 'ignored',
    }, NOW);
    assert.deepEqual(report.completedBooks.map((b) => b.bookId), ['b1', 'b2']);
    assert.equal(report.completedBooks[1].completedAt.getTime(), NOW.getTime());
    assert.deepEqual(report.inProgressBooks.map((p) => p.bookId), ['b4']);
    assert.deepEqual(report.completedGames.map((g) => g.gameId), ['creation-day-1']);
    assert.deepEqual(report.island, { buildings: ['garden', '42'], harvestCount: 7, cookedRecipeCount: undefined });
    assert.equal('parentNotes' in report, false);
});

test('mergeProgress unions completions, keeps the first completion time and prunes finished books from in-progress', () => {
    const existing = {
        completedBooks: [{ bookId: 'b1', completedAt: ago(5 * DAY) }],
        inProgressBooks: [{ bookId: 'b2', pageIndex: 4, lastReadAt: ago(2 * DAY) }, { bookId: 'b3', pageIndex: 1, lastReadAt: ago(DAY) }],
        completedGames: [{ gameId: 'g1', completedAt: ago(3 * DAY) }],
        island: { buildings: ['hut'], harvestCount: 5, cookedRecipeCount: 1 },
    };
    const report = sanitizeProgressReport({
        completedBooks: [{ bookId: 'b1', completedAt: ago(DAY) }, { bookId: 'b2', completedAt: ago(DAY) }],
        inProgressBooks: [{ bookId: 'b3', pageIndex: 6, lastReadAt: NOW }, { bookId: 'b3', pageIndex: 2, lastReadAt: ago(3 * DAY) }],
        completedGames: ['g1', 'g2'],
        island: { buildings: ['garden'], harvestCount: 2 },
    }, NOW);
    const merged = mergeProgress(existing, report, NOW);

    assert.deepEqual(merged.completedBooks.map((b) => [b.bookId, b.completedAt.getTime()]), [
        ['b2', ago(DAY).getTime()],
        ['b1', ago(5 * DAY).getTime()],
    ]);
    assert.deepEqual(merged.inProgressBooks, [{ bookId: 'b3', pageIndex: 6, lastReadAt: NOW }]);
    assert.deepEqual(merged.completedGames.map((g) => g.gameId).sort(), ['g1', 'g2']);
    assert.equal(merged.completedGames.find((g) => g.gameId === 'g1').completedAt.getTime(), ago(3 * DAY).getTime());
    assert.deepEqual(merged.island, { buildings: ['hut', 'garden'], harvestCount: 5, cookedRecipeCount: 1, updatedAt: NOW });
});

test('mergeProgress leaves island untouched when a report has none', () => {
    const island = { buildings: ['hut'], harvestCount: 0, cookedRecipeCount: 0, updatedAt: ago(DAY) };
    assert.equal(mergeProgress({ island }, sanitizeProgressReport({}, NOW), NOW).island, island);
});

test('buildUserState derives premium status and sorts completions newest first', () => {
    const state = buildUserState({
        _id: 'u',
        subscriptionStatus: 'reverse_trial',
        learningProgress: { completedBooks: [{ bookId: 'old', completedAt: ago(3 * DAY) }, { bookId: 'new', completedAt: ago(DAY) }] },
    });
    assert.equal(state.isPremium, true);
    assert.deepEqual(state.completedBooks.map((b) => b.bookId), ['new', 'old']);
    assert.equal(state.island, null);
    assert.equal(buildUserState({ _id: 'u', subscriptionStatus: 'expired' }).isPremium, false);
});
