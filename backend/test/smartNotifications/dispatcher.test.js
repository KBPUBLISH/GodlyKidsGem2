const test = require('node:test');
const assert = require('node:assert/strict');
const { createDispatcher, createOneSignalSender } = require('../../src/services/smartNotifications/dispatcher');
const { createSmartNotifier } = require('../../src/services/smartNotifications');
const { DAY, NOW, ago, makeCatalog, makeUser } = require('./fixtures');

/** In-memory stand-in for NotificationLog with the same unique (userKey, dedupeKey) guarantee. */
const memoryLogStore = () => {
    const rows = new Map();
    const key = (userKey, dedupeKey) => `${userKey}|${dedupeKey}`;
    return {
        rows,
        async claim(doc) {
            await new Promise((r) => setImmediate(r)); // interleave concurrent callers like a real DB would
            if (rows.has(key(doc.userKey, doc.dedupeKey))) return false;
            rows.set(key(doc.userKey, doc.dedupeKey), { ...doc, status: 'pending' });
            return true;
        },
        async release(userKey, keys) {
            for (const k of keys) if (rows.get(key(userKey, k))?.status === 'pending') rows.delete(key(userKey, k));
        },
        async markSent(userKey, keys) {
            for (const k of keys) rows.get(key(userKey, k)).status = 'sent';
        },
        async history(userKey) {
            return [...rows.values()].filter((r) => r.userKey === userKey && !r.dedupeKey.startsWith('slot:'));
        },
    };
};

const notification = { dedupeKey: 'track:creation_week:2', ruleId: 'track_unlock', category: 'game_unlock', title: 'Day 2!', message: 'm' };

test('concurrent dispatches of the same message send exactly once', async () => {
    const logStore = memoryLogStore();
    let sends = 0;
    const dispatcher = createDispatcher({ logStore, send: async () => { sends++; return true; } });
    const user = makeUser();
    const results = await Promise.all([1, 2, 3].map(() => dispatcher.dispatch({ user, notification, now: NOW })));
    assert.equal(sends, 1);
    assert.equal(results.filter((r) => r.sent).length, 1);
});

test('at most one smart notification per user per day, even for different messages', async () => {
    const logStore = memoryLogStore();
    const dispatcher = createDispatcher({ logStore, send: async () => true });
    const user = makeUser();
    assert.equal((await dispatcher.dispatch({ user, notification, now: NOW })).sent, true);
    const other = { ...notification, dedupeKey: 'island_tip:starter_kitchen' };
    assert.deepEqual(await dispatcher.dispatch({ user, notification: other, now: NOW }), { sent: false, reason: 'daily_slot_taken' });
    const tomorrow = new Date(NOW.getTime() + DAY);
    assert.equal((await dispatcher.dispatch({ user, notification: other, now: tomorrow })).sent, true);
    assert.deepEqual(await dispatcher.dispatch({ user, notification, now: new Date(NOW.getTime() + 2 * DAY) }), { sent: false, reason: 'duplicate' });
});

test('a failed push releases its claims so it can be retried', async () => {
    const logStore = memoryLogStore();
    let fail = true;
    const dispatcher = createDispatcher({ logStore, send: async () => !fail });
    const user = makeUser();
    assert.deepEqual(await dispatcher.dispatch({ user, notification, now: NOW }), { sent: false, reason: 'send_failed' });
    assert.equal(logStore.rows.size, 0);
    fail = false;
    assert.equal((await dispatcher.dispatch({ user, notification, now: NOW })).sent, true);
});

test('OneSignal sender prefers the player id and falls back to the app\'s external id (email, then deviceId)', async () => {
    const calls = [];
    const service = {
        sendNotificationByPlayerId: async (p) => { calls.push(['player', p.playerId]); return { id: 1 }; },
        sendNotificationToUser: async (p) => { calls.push(['external', p.userId, p.data.type]); return { id: 2 }; },
    };
    const send = createOneSignalSender(service);
    await send(makeUser({}, { oneSignalPlayerId: 'p-1' }), notification);
    await send(makeUser({}, { email: 'mom@example.com' }), notification);
    await send(makeUser(), notification);
    assert.deepEqual(calls, [['player', 'p-1'], ['external', 'mom@example.com', 'smart'], ['external', 'device-abc', 'smart']]);
});

test('end to end: a user gets Day 2, then Day 3 the next time, with no repeats', async () => {
    const logStore = memoryLogStore();
    const sentTitles = [];
    const config = { enabled: true, minHoursBetween: 20, maxPerWeek: 4, quietHoursStart: 20, quietHoursEnd: 8, categoryCooldownHours: {} };
    const notifier = createSmartNotifier({ catalog: makeCatalog(), logStore, config, send: async (u, n) => { sentTitles.push(n.title); return true; } });

    const user = makeUser({ completedGames: [{ gameId: 'creation-day-1', completedAt: ago(DAY) }] });
    assert.equal((await notifier.notifyUser(user, NOW)).sent, true);
    assert.equal((await notifier.notifyUser(user, NOW)).sent, false);

    user.learningProgress.completedGames.push({ gameId: 'creation-day-2', completedAt: NOW });
    const later = new Date(NOW.getTime() + DAY);
    assert.equal((await notifier.notifyUser(user, later)).sent, true);
    assert.deepEqual(sentTitles, ['🎮 New game unlocked: Day 2 of Creation Week!', '🎮 New game unlocked: Day 3 of Creation Week!']);
});

test('opted-out users are skipped', async () => {
    const notifier = createSmartNotifier({ catalog: makeCatalog(), logStore: memoryLogStore(), send: async () => true, config: { enabled: true } });
    assert.deepEqual(await notifier.notifyUser(makeUser({}, { smartNotificationsDisabled: true }), NOW), { sent: false, reason: 'opted_out' });
});
