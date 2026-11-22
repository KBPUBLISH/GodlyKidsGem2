const test = require('node:test');
const assert = require('node:assert/strict');
const { selectNotification, inQuietHours } = require('../../src/services/smartNotifications/engine');
const { HOUR, DAY, NOW, ago, makeCatalog, makeState } = require('./fixtures');

const config = {
    enabled: true,
    minHoursBetween: 20,
    maxPerWeek: 4,
    quietHoursStart: 20,
    quietHoursEnd: 8,
    categoryCooldownHours: { game_unlock: 20, reading: 72, island: 96 },
};

// A busy player: Creation Week Day 2 ready, a bonus game unlocked, a half-read book, a growing island.
const busyState = () => makeState({
    completedGames: [{ gameId: 'creation-day-1', completedAt: ago(DAY) }],
    completedBooks: [{ bookId: 'noah1', completedAt: ago(DAY) }],
    inProgressBooks: [{ bookId: 'david', pageIndex: 5, lastReadAt: ago(2 * DAY) }],
    island: { buildings: ['hut', 'garden'], harvestCount: 1, cookedRecipeCount: 0, updatedAt: ago(DAY) },
});

const select = (overrides = {}) => selectNotification({ state: busyState(), catalog: makeCatalog(), history: [], now: NOW, config, ...overrides });
const sent = (dedupeKey, category, when) => ({ dedupeKey, category, sentAt: when });

test('picks the highest-priority trigger', () => {
    const { notification, candidates } = select();
    assert.equal(notification.dedupeKey, 'track:creation_week:2');
    assert.equal(notification.ruleId, 'track_unlock');
    assert.deepEqual(
        candidates.map((c) => c.ruleId).slice(0, 4),
        ['track_unlock', 'book_games_unlocked', 'continue_reading', 'next_in_series'],
    );
});

test('never repeats a message that was already sent', () => {
    const history = [sent('track:creation_week:2', 'game_unlock', ago(3 * DAY))];
    assert.equal(select({ history }).notification.dedupeKey, 'book_games:noah1');
});

test('enforces a minimum gap between smart notifications', () => {
    const history = [sent('island_tip:x', 'island', ago(5 * HOUR))];
    assert.deepEqual([select({ history }).notification, select({ history }).reason], [null, 'min_gap']);
});

test('enforces the weekly cap', () => {
    const history = [1, 2, 3, 4].map((d) => sent(`k${d}`, 'island', ago(d * DAY + HOUR)));
    assert.equal(select({ history, config: { ...config, categoryCooldownHours: {} } }).reason, 'weekly_cap');
    assert.ok(select({ history: history.slice(0, 3), config: { ...config, categoryCooldownHours: {} } }).notification);
});

test('applies per-category cooldowns', () => {
    const history = [sent('continue:jonah', 'reading', ago(2 * DAY)), sent('book_games:x', 'game_unlock', ago(DAY))];
    const { notification, candidates } = select({ history });
    assert.equal(notification.category, 'game_unlock'); // 24h > 20h cooldown
    const onlyReadingCooling = select({ history: [sent('continue:jonah', 'reading', ago(2 * DAY))], state: makeState({
        inProgressBooks: [{ bookId: 'david', pageIndex: 5, lastReadAt: ago(2 * DAY) }],
    }) });
    assert.equal(onlyReadingCooling.reason, 'no_candidates');
    assert.ok(candidates.every((c) => c.category !== 'reading'));
});

test('stays silent during the user\'s local quiet hours', () => {
    const lateNight = new Date('2026-11-17T03:00:00Z'); // 10pm New York
    assert.equal(select({ now: lateNight }).reason, 'quiet_hours');
    const tokyoState = Object.assign(busyState(), { timezone: 'Asia/Tokyo' }); // 4am Tokyo at NOW
    assert.equal(select({ state: tokyoState }).reason, 'quiet_hours');
});

test('respects the global kill switch and returns nothing without signals', () => {
    assert.equal(select({ config: { ...config, enabled: false } }).reason, 'disabled');
    assert.equal(select({ state: makeState({}) }).reason, 'no_candidates');
});

test('inQuietHours handles windows that wrap midnight and ones that do not', () => {
    assert.equal(inQuietHours(21, 20, 8), true);
    assert.equal(inQuietHours(7, 20, 8), true);
    assert.equal(inQuietHours(12, 20, 8), false);
    assert.equal(inQuietHours(13, 12, 14), true);
    assert.equal(inQuietHours(null, 20, 8), false);
});
